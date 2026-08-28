#!/usr/bin/env python3
"""Low-bandwidth weekly scanner for relevant Professor Auxiliar openings."""
from __future__ import annotations
import argparse, datetime, hashlib, html, json, re, sys, time, unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parent; MAX_BYTES=2_000_000; TIMEOUT=20
ROLE=("professor auxiliar","professora auxiliar","assistant professor")
AREAS=("inteligencia artificial","artificial intelligence","machine learning","deep learning","robotica","robotics","autonomous","computer vision","visao computacional","percepcao","perception","lidar","engenharia eletrotecnica","engenharia electrotecnica","electrical engineering","engenharia informatica","computer engineering","computer science","ciencia de computadores","ciencias da computacao","informatica","sistemas computacionais","computer systems","automacao","automation","controlo","control","signal processing","processamento de sinal","telecomunicacoes","telecommunications","embedded systems","sistemas embebidos")

def fold(s): return " ".join("".join(c for c in unicodedata.normalize("NFKD",html.unescape(s)) if not unicodedata.combining(c)).lower().split())
def relevant(s):
    s=fold(s); return any(x in s for x in ROLE) and any(x in s for x in AREAS)
def deadline(s):
    s=fold(s)
    m=re.search(r"(?:candidaturas?|deadline|applications?|ate|until)[^\d]{0,30}(\d{1,2})[./-](\d{1,2})[./-](20\d{2})",s)
    if m: d,mo,y=m.groups(); return f"{y}-{int(mo):02d}-{int(d):02d}"
    m=re.search(r"(?:candidaturas?|deadline|applications?|ate|until)[^\d]{0,30}(20\d{2})-(\d{2})-(\d{2})",s)
    return "-".join(m.groups()) if m else "unknown"

class Links(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.out=[]; self.href=None; self.text=[]
    def handle_starttag(self,tag,attrs):
        if tag=="a": self.href=dict(attrs).get("href"); self.text=[]
    def handle_data(self,data):
        if self.href is not None: self.text.append(data)
    def handle_endtag(self,tag):
        if tag=="a" and self.href is not None: self.out.append((self.href," ".join(self.text).strip())); self.href=None

def fetch(url):
    req=Request(url,headers={"User-Agent":"ProfessorRadar/1.0 (+https://tiagobarros-research.com)","Accept":"text/html"})
    with urlopen(req,timeout=TIMEOUT) as r: return r.read(MAX_BYTES+1),r.headers.get_content_charset() or "utf-8"
def decode(raw,charset):
    if len(raw)>MAX_BYTES: raise ValueError("response exceeds 2 MB")
    try: return raw.decode(charset)
    except (LookupError,UnicodeDecodeError): return raw.decode("utf-8",errors="replace")
def visible(page): return " ".join(html.unescape(re.sub(r"<[^>]+>"," ",re.sub(r"<(script|style)\b.*?</\1>"," ",page,flags=re.I|re.S))).split())
def candidates(page,base,hosts):
    p=Links(); p.feed(page); out={}
    for href,label in p.out:
        url=urljoin(base,href).split("#",1)[0]; clue=fold(label+" "+href)
        if urlparse(url).hostname in hosts and (any(x in clue for x in ROLE) or any(x in clue for x in ("docente","concurso","recrut","procedure"))): out.setdefault(url,label)
    return sorted(out.items())
def load(path,default):
    try: return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError: return default

def scan(src,old):
    raw,charset=fetch(src["url"]); digest=hashlib.sha256(raw).hexdigest()
    if old.get("listing_sha256")==digest: return old.get("positions",[]),old,"unchanged"
    found=[]; listing=decode(raw,charset); links=candidates(listing,src["url"],src["allowed_hosts"]); expanded=[]
    # Expand generic category/search links once. A category page is never itself a result.
    for url,label in links:
        clue=fold(label)
        if relevant(label): expanded.append((url,label)); continue
        if any(role in clue for role in ROLE): continue
        try: body,cs=fetch(url); expanded.extend(candidates(decode(body,cs),url,src["allowed_hosts"]))
        except (HTTPError,URLError,TimeoutError,ValueError): continue
        time.sleep(.15)
    for url,label in sorted(dict(expanded).items()):
        if not relevant(label): continue
        if "encerrad" in fold(label): continue
        text=label
        try: body,cs=fetch(url); text+= " "+visible(decode(body,cs))
        except (HTTPError,URLError,TimeoutError,ValueError): pass
        closes=deadline(text)
        if closes!="unknown" and closes < datetime.date.today().isoformat(): continue
        found.append({"university":src["university"],"title":" ".join(label.split())[:500],"department":"","deadline":closes,"link":url,"source":urlparse(url).hostname or src["id"],"relevant":True})
    found.sort(key=lambda x:(x["deadline"]=="unknown",x["deadline"],x["link"]))
    state={"listing_sha256":digest,"positions":found}; return found,state,"ok" if found else "empty"

def self_test():
    sample='<a href="/job/1">Professor Auxiliar — Inteligência Artificial — candidaturas até 30/09/2026</a>'
    got=candidates(sample,"https://example.pt/jobs",["example.pt"]); assert len(got)==1 and relevant(got[0][1]); assert deadline(got[0][1])=="2026-09-30"; assert not relevant("Professor Auxiliar — História"); assert "encerrad" in fold("Candidaturas encerradas")
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--sources",type=Path,default=ROOT/"sources.json"); ap.add_argument("--results",type=Path,default=ROOT/"results.json"); ap.add_argument("--state",type=Path,default=ROOT/"scan_state.json"); ap.add_argument("--self-test",action="store_true"); a=ap.parse_args()
    if a.self_test: self_test(); return 0
    cfg=load(a.sources,{"sources":[]})["sources"]; old=load(a.state,{"sources":{}})["sources"]; states={}; statuses={}; positions=[]; failures=0
    for src in cfg:
        try: items,state,status=scan(src,old.get(src["id"],{}))
        except (HTTPError,URLError,TimeoutError,ValueError) as e: items=old.get(src["id"],{}).get("positions",[]); state=old.get(src["id"],{}); status=f"error:{type(e).__name__}"; failures+=1
        states[src["id"]]=state; statuses[src["id"]]=status; positions+=items
    if failures==len(cfg): print("all sources failed; preserving output",file=sys.stderr); return 1
    unique={x["link"]:x for x in positions}; output={"last_scan":time.strftime("%Y-%m-%d %H:%M UTC",time.gmtime()),"scan_sources":statuses,"positions":sorted(unique.values(),key=lambda x:(x["deadline"]=="unknown",x["deadline"],x["university"],x["link"]))}
    a.results.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); a.state.write_text(json.dumps({"sources":states},ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); return 0
if __name__=="__main__": raise SystemExit(main())
