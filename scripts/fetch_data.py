import json, urllib.request, time, os, math, pathlib
OUT=str(pathlib.Path(__file__).resolve().parent.parent/"data")
os.makedirs(OUT, exist_ok=True)
def get_json(url):
    req=urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())
def yahoo(symbol, range_, interval):
    url=f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range_}&interval={interval}&includePrePost=false"
    d=get_json(url)
    res=d["chart"]["result"][0]
    ts=res["timestamp"]; q=res["indicators"]["quote"][0]
    out=[]
    for i,t in enumerate(ts):
        o,qo=q["open"][i],q["close"][i]
        if o is None or qo is None: continue
        out.append({"t":t*1000,"o":round(float(o),5),"h":round(float(q["high"][i]),5),"l":round(float(q["low"][i]),5),"c":round(float(qo),5)})
    return out
def kraken(pair, interval, since=None):
    url=f"https://api.kraken.com/0/public/OHLC?pair={pair}&interval={interval}"
    d=get_json(url)
    key=list(d["result"].keys())[0]
    rows=d["result"][key]
    out=[]
    for r in rows:
        out.append({"t":int(r[0])*1000,"o":float(r[1]),"h":float(r[2]),"l":float(r[3]),"c":float(r[4])})
    return out

jobs=[]
# Yahoo symbols
for sym, name in [("GC=F","XAUUSD"),("EURUSD=X","EURUSD"),("GBPUSD=X","GBPUSD")]:
    for rng, iv, tf in [("2y","1d","D1"),("1y","1h","H1"),("60d","15m","M15")]:
        try:
            data=yahoo(sym, rng, iv)
            print(name, tf, len(data), data[-1] if data else None)
            jobs.append((name, tf, data))
        except Exception as e:
            print("FAIL yahoo", name, tf, e)
# Kraken
for pair, name in [("XBTUSD","BTCUSD"),("ETHUSD","ETHUSD")]:
    for iv, tf in [(1440,"D1"),(60,"H1"),(15,"M15")]:
        try:
            data=kraken(pair, iv)
            print(name, tf, len(data), data[-1] if data else None)
            jobs.append((name, tf, data))
        except Exception as e:
            print("FAIL kraken", name, tf, e)

# save per symbol
from collections import defaultdict
by=defaultdict(dict)
for name, tf, data in jobs:
    by[name][tf]=data
for name, tfs in by.items():
    with open(f"{OUT}/{name}.json","w") as f:
        json.dump({"symbol":name,"updated":time.strftime("%Y-%m-%d"),"timeframes":tfs}, f)
    print(name, {k:len(v) for k,v in tfs.items()}, "bytes", os.path.getsize(f"{OUT}/{name}.json"))
