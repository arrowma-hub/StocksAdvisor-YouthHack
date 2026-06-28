import { useState, useEffect, useRef, useCallback } from "react";

const T = {
  black:"#0A0A0A", offBlk:"#111111", lime:"#CCFF00", white:"#FFFFFF",
  grey:"#888888", dkGrey:"#222222", mdGrey:"#333333",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;}
  body{background:#0A0A0A;color:#fff;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:#0A0A0A;}
  ::-webkit-scrollbar-thumb{background:#CCFF00;}
  input,textarea{font-family:inherit;}
  input::placeholder,textarea::placeholder{color:#555;}
  @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes glitch1{
    0%,100%{clip-path:inset(0 0 95% 0);transform:translateX(0)}
    20%{clip-path:inset(30% 0 50% 0);transform:translateX(-4px)}
    40%{clip-path:inset(60% 0 20% 0);transform:translateX(4px)}
    60%{clip-path:inset(10% 0 80% 0);transform:translateX(-2px)}
    80%{clip-path:inset(80% 0 5% 0);transform:translateX(2px)}
  }
  @keyframes glitch2{
    0%,100%{clip-path:inset(90% 0 0 0);transform:translateX(0)}
    20%{clip-path:inset(50% 0 30% 0);transform:translateX(4px)}
    40%{clip-path:inset(20% 0 60% 0);transform:translateX(-4px)}
    60%{clip-path:inset(70% 0 10% 0);transform:translateX(2px)}
    80%{clip-path:inset(5% 0 85% 0);transform:translateX(-2px)}
  }
  .nav-btn:hover{background:#CCFF00!important;color:#000!important;}
  .card-hover:hover{border-color:#CCFF00!important;}
  .lime-btn:hover{background:#fff!important;color:#000!important;}
  .ghost-btn:hover{background:#CCFF00!important;color:#000!important;border-color:#CCFF00!important;}
`;

/* ── Finnhub proxy helper ── */
async function fh(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`/api/finnhub?${qs}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function fmt(n) { return (n == null || isNaN(n)) ? "—" : Number(n).toFixed(2); }
function fmtChg(n) { return (n == null || isNaN(n)) ? "—" : (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%"; }
function fmtLarge(n) {
  if (!n) return "N/A";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "T";
  return "$" + n.toFixed(1) + "B";
}

/* ── useInView ── */
function useInView(th = 0.12) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: th });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, vis];
}

/* ── Scoring logic (pure Finnhub, no AI) ── */
function scoreStock(q, metric) {
  let score = 3;
  const dp = q?.dp ?? 0;
  const c = q?.c ?? 0;
  const pc = q?.pc ?? c;
  const high52 = metric?.metric?.["52WeekHigh"] ?? c;
  const low52 = metric?.metric?.["52WeekLow"] ?? c;
  const beta = metric?.metric?.beta ?? 1;
  const range = high52 - low52;
  const posInRange = range > 0 ? (c - low52) / range : 0.5;

  if (dp > 2) score += 0.5;
  else if (dp > 0.5) score += 0.25;
  else if (dp < -2) score -= 0.5;
  else if (dp < -0.5) score -= 0.25;

  if (posInRange > 0.75) score += 0.5;
  else if (posInRange > 0.5) score += 0.25;
  else if (posInRange < 0.25) score -= 0.5;
  else if (posInRange < 0.4) score -= 0.25;

  if (beta > 2) score -= 0.25;
  else if (beta < 0.8) score += 0.25;

  score = Math.max(1, Math.min(5, Math.round(score * 2) / 2));
  const label = score >= 4.5 ? "Strong Buy" : score >= 3.5 ? "Buy" : score >= 2.5 ? "Neutral" : score >= 1.5 ? "Sell" : "Strong Sell";
  return { score, label };
}

function macdSignal(q) {
  const dp = q?.dp ?? 0;
  const c = q?.c ?? 0;
  const h = q?.h ?? c;
  const l = q?.l ?? c;
  const mid = (h + l) / 2;
  if (dp > 1.5 && c > mid) return { signal: "Bullish Crossover", trend: "Uptrend", histogram: "Expanding" };
  if (dp < -1.5 && c < mid) return { signal: "Bearish Crossover", trend: "Downtrend", histogram: "Expanding" };
  if (dp > 0) return { signal: "Neutral / Consolidating", trend: "Sideways", histogram: "Flat" };
  return { signal: "Neutral / Consolidating", trend: "Sideways", histogram: "Contracting" };
}

function volLevel(beta) {
  if (!beta || beta < 0.8) return "Low";
  if (beta < 1.3) return "Medium";
  if (beta < 2) return "High";
  return "Extreme";
}

/* ─────────────────────────────────────── TICKER BAR ── */
const TICKER_SYMS = ["AAPL","TSLA","NVDA","MSFT","AMZN","GOOGL","META","JPM","V","NFLX"];

function Ticker() {
  const [quotes, setQuotes] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const results = await Promise.all(
          TICKER_SYMS.map(s => fh("quote", { symbol: s })
            .then(d => ({ s, p: d.c != null ? d.c.toFixed(2) : "—", chg: fmtChg(d.dp), up: (d.dp ?? 0) >= 0 }))
            .catch(() => ({ s, p: "—", chg: "—", up: true })))
        );
        if (!cancelled) setQuotes(results);
      } catch (_) {}
    }
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const items = quotes.length ? quotes : TICKER_SYMS.map(s => ({ s, p: "…", chg: "", up: true }));
  return (
    <div style={{overflow:"hidden",borderBottom:`1px solid ${T.dkGrey}`,background:T.offBlk,padding:"7px 0",position:"fixed",top:52,left:0,right:0,zIndex:90}}>
      <div style={{display:"flex",gap:56,animation:"ticker 32s linear infinite",whiteSpace:"nowrap",width:"max-content"}}>
        {[...items,...items].map((t,i)=>(
          <span key={i} style={{fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:.5}}>
            <span style={{color:T.lime,fontWeight:700}}>{t.s}</span>{" "}
            <span style={{color:T.white}}>{t.p!=="—"?`$${t.p}`:"—"}</span>{" "}
            <span style={{color:t.up?"#00FF88":"#FF4444"}}>{t.chg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── NAV ── */
const PAGES = ["Home","How It Works","Stock Basics","News Updates","Indicators","AI Advisor"];
function Nav({page,setPage}) {
  const [scrolled,setScrolled] = useState(false);
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>10);
    window.addEventListener("scroll",h);
    return()=>window.removeEventListener("scroll",h);
  },[]);
  return (
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,background:scrolled?"rgba(10,10,10,0.98)":T.black,borderBottom:`1px solid ${T.dkGrey}`,display:"flex",alignItems:"center",padding:"0 28px",height:52,gap:16,transition:"background 0.3s"}}>
      <div onClick={()=>setPage("Home")} style={{cursor:"pointer",display:"flex",alignItems:"center",gap:6,marginRight:"auto",flexShrink:0}}>
        <div style={{width:22,height:22,background:T.lime,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:12,fontWeight:900,color:T.black}}>S</span>
        </div>
        <span style={{fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,color:T.white,letterSpacing:1}}>STOCKS</span>
        <span style={{fontFamily:"'Space Mono',monospace",fontWeight:400,fontSize:13,color:T.lime,letterSpacing:1}}>ADVISOR</span>
      </div>
      <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
        {PAGES.map(p=>(
          <button key={p} className="nav-btn" onClick={()=>setPage(p)} style={{background:page===p?T.lime:"transparent",color:page===p?T.black:T.grey,border:"none",borderRadius:4,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Space Mono',monospace",letterSpacing:.5,transition:"all 0.15s",textTransform:"uppercase"}}>{p}</button>
        ))}
      </div>
    </nav>
  );
}

function GlitchText({text,style={}}) {
  return (
    <div style={{position:"relative",display:"inline-block",...style}}>
      <span style={{position:"relative",zIndex:2}}>{text}</span>
      <span aria-hidden style={{position:"absolute",inset:0,color:T.lime,animation:"glitch1 3s infinite 0.5s",zIndex:1}}>{text}</span>
      <span aria-hidden style={{position:"absolute",inset:0,color:"#FF0066",animation:"glitch2 3s infinite 1s",zIndex:1}}>{text}</span>
    </div>
  );
}

function MiniBarChart({vis}) {
  const bars=[35,55,40,70,50,80,60,90,72,85,65,95];
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80}}>
      {bars.map((h,i)=>(
        <div key={i} style={{width:16,background:i===bars.length-1?T.lime:T.dkGrey,height:vis?`${h}%`:"0%",transition:`height 0.6s ease ${i*60}ms`,borderRadius:"2px 2px 0 0",flexShrink:0}}/>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────── HOME ── */
function HomePage({setPage}) {
  const [ref,vis]=useInView(0.01);
  const [sr,sv]=useInView();
  return (
    <div>
      <section ref={ref} style={{minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",padding:"120px 48px 80px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:80,right:80,width:200,height:340,background:T.lime,borderRadius:120,opacity:0.12,animation:"pulse 6s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:160,right:120,width:40,height:40,background:T.lime,borderRadius:"50%"}}/>
        <div style={{position:"absolute",bottom:120,left:40,width:28,height:200,background:T.lime,borderRadius:20}}/>
        <div style={{opacity:vis?1:0,transition:"opacity 0.6s 0.1s",marginBottom:32}}>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",border:`1px solid ${T.lime}`,padding:"4px 12px",borderRadius:2}}>AI-POWERED · STOCK INTELLIGENCE · TRACK 1</span>
        </div>
        <div style={{opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(30px)",transition:"all 0.8s 0.2s"}}>
          <div style={{fontSize:"clamp(60px,12vw,130px)",fontWeight:900,lineHeight:0.9,letterSpacing:-3,fontFamily:"'Space Grotesk',sans-serif",marginBottom:8}}>
            <GlitchText text="STOCKS" style={{display:"block",color:T.white}}/>
          </div>
          <div style={{fontSize:"clamp(56px,11vw,120px)",fontWeight:900,lineHeight:0.9,letterSpacing:-3,fontFamily:"'Space Grotesk',sans-serif",color:T.lime,marginBottom:40}}>ADVISOR</div>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",gap:48,flexWrap:"wrap",opacity:vis?1:0,transition:"opacity 1s 0.5s"}}>
          <div style={{maxWidth:420}}>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,lineHeight:1.7,color:T.grey,marginBottom:28}}>A user-friendly website that provides all the info you need about stocks, regardless of skill level. From absolute beginners to professionals — Stocks Advisor is the site for everyone.</p>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <button className="lime-btn" onClick={()=>setPage("Indicators")} style={{background:T.lime,color:T.black,border:"none",borderRadius:4,padding:"13px 28px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Space Mono',monospace",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s"}}>LIVE ANALYSIS →</button>
              <button className="ghost-btn" onClick={()=>setPage("Stock Basics")} style={{background:"transparent",color:T.white,border:`1px solid ${T.dkGrey}`,borderRadius:4,padding:"13px 28px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Space Mono',monospace",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s"}}>LEARN BASICS</button>
            </div>
          </div>
          <div ref={sr} style={{display:"flex",gap:32,flexWrap:"wrap"}}>
            <MiniBarChart vis={sv}/>
            <div style={{display:"flex",flexDirection:"column",gap:16,justifyContent:"flex-end"}}>
              {[["8,500+","Stocks tracked"],["Real-time","Finnhub data"],["100%","Free to use"]].map(([n,l])=>(
                <div key={l}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,color:T.lime,lineHeight:1}}>{n}</div>
                  <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,color:T.grey,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{position:"absolute",bottom:40,right:48,fontFamily:"'Space Mono',monospace",fontSize:11,color:T.grey,letterSpacing:2}}>PAGE 01</div>
      </section>

      <section style={{borderTop:`1px solid ${T.dkGrey}`,borderBottom:`1px solid ${T.dkGrey}`}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
          {[{icon:"📊",label:"MACD Analysis"},{icon:"📰",label:"Live News"},{icon:"⭐",label:"Buy/Sell Rating"},{icon:"📈",label:"Price Volatility"},{icon:"💹",label:"Real-time Quotes"},{icon:"🎓",label:"Learning Guides"}].map((f,i)=>(
            <div key={i} className="card-hover" style={{borderRight:`1px solid ${T.dkGrey}`,padding:"28px 24px",transition:"border-color 0.2s"}}>
              <div style={{fontSize:22,marginBottom:10}}>{f.icon}</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:T.white,letterSpacing:1,textTransform:"uppercase"}}>{f.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{padding:"100px 48px",maxWidth:1000,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:20}}>OUR MISSION</div>
            <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(28px,4vw,44px)",fontWeight:900,lineHeight:1.1,marginBottom:24}}>Making the real-money world<br/><span style={{color:T.lime}}>accessible to all.</span></h2>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,lineHeight:1.8,color:T.grey}}>We built Stocks Advisor to represent our own twist on how real-time data can help everyone engage with the financial world. From live Finnhub market data to clear educational guides — Stocks Advisor provides the necessary information to help users find the best pathway for success.</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",border:`1px solid ${T.dkGrey}`,borderRadius:2}}>
            {[["Created by","Aroma Mahbub & Anikait Datta"],["Project","Track 1 — AI in Finance"],["Data","Finnhub Real-time API"],["Goal","Demystify stock investing"]].map(([k,v],i)=>(
              <div key={i} style={{padding:"18px 24px",borderBottom:i<3?`1px solid ${T.dkGrey}`:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.grey,textTransform:"uppercase",letterSpacing:1,flexShrink:0}}>{k}</span>
                <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.white,fontWeight:600,textAlign:"right"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{borderTop:`1px solid ${T.dkGrey}`,padding:"80px 48px"}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:40,textAlign:"center"}}>EXPLORE THE SITE</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:1,border:`1px solid ${T.dkGrey}`,maxWidth:1000,margin:"0 auto"}}>
          {[{p:"How It Works",icon:"⚙️",desc:"See how our system turns raw data into clear signals"},{p:"Stock Basics",icon:"📚",desc:"Ground-up education — concepts, strategies & indicators"},{p:"News Updates",icon:"🗞️",desc:"Live market news from Finnhub"},{p:"Indicators",icon:"📊",desc:"Real-time quote + technical analysis on any stock"},{p:"AI Advisor",icon:"🤖",desc:"Interactive Q&A guide powered by market knowledge"}].map(({p,icon,desc})=>(
            <div key={p} onClick={()=>setPage(p)} className="card-hover" style={{background:T.offBlk,padding:"36px 28px",cursor:"pointer",borderRight:`1px solid ${T.dkGrey}`,transition:"all 0.2s"}} onMouseEnter={e=>e.currentTarget.style.background=T.dkGrey} onMouseLeave={e=>e.currentTarget.style.background=T.offBlk}>
              <div style={{fontSize:28,marginBottom:16}}>{icon}</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:13,color:T.lime,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{p}</div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.6}}>{desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────── HOW IT WORKS ── */
function HowItWorksPage() {
  const steps=[
    {n:"01",icon:"📋",title:"Pick Your Stocks",desc:"Enter any US ticker symbol on the Indicators page — or browse the live news feed to spot what's moving today.",color:T.lime},
    {n:"02",icon:"📡",title:"Live Data Pull",desc:"Finnhub's real-time API fetches the current price, today's open/high/low, previous close, 52-week range, beta, and market cap instantly.",color:T.white},
    {n:"03",icon:"📊",title:"MACD Signal",desc:"We calculate a MACD-style momentum signal from intraday price action — showing whether momentum is bullish, bearish, or consolidating.",color:T.lime},
    {n:"04",icon:"🌊",title:"Volatility Rating",desc:"Beta is used to classify each stock as Low, Medium, High, or Extreme volatility — so you immediately know the risk profile.",color:T.white},
    {n:"05",icon:"⭐",title:"Buy/Sell Score",desc:"A 1–5 score is calculated from today's price change, position in the 52-week range, and beta adjustment — no guesswork, pure data.",color:T.lime},
    {n:"06",icon:"🗞️",title:"News Context",desc:"The News Updates page pulls real Finnhub headlines — so you can connect price moves to the events driving them.",color:T.white},
  ];
  return (
    <div style={{padding:"100px 48px 80px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{marginBottom:72}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>THE PIPELINE</div>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(36px,7vw,80px)",fontWeight:900,lineHeight:0.95,letterSpacing:-2}}>HOW IT<br/><span style={{color:T.lime}}>WORKS</span></h1>
      </div>
      <div style={{display:"grid",gap:1}}>
        {steps.map((s,i)=>{
          const [ref,vis]=useInView();
          return (
            <div ref={ref} key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr",borderTop:`1px solid ${T.dkGrey}`,opacity:vis?1:0,transform:vis?"translateX(0)":"translateX(-24px)",transition:`all 0.5s ease ${i*80}ms`}}>
              <div style={{padding:"28px 24px",borderRight:`1px solid ${T.dkGrey}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.grey}}>{s.n}</span>
              </div>
              <div style={{padding:"28px 32px",display:"flex",alignItems:"flex-start",gap:20}} onMouseEnter={e=>e.currentTarget.style.background=T.offBlk} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <span style={{fontSize:24,flexShrink:0,marginTop:2}}>{s.icon}</span>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:13,fontWeight:700,color:s.color,letterSpacing:1,marginBottom:8,textTransform:"uppercase"}}>{s.title}</div>
                  <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,color:T.grey,lineHeight:1.75}}>{s.desc}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{borderTop:`1px solid ${T.dkGrey}`}}/>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── STOCK BASICS ── */
function StockBasicsPage() {
  const [active,setActive]=useState(0);
  const topics=[
    {icon:"📦",title:"What Is a Stock?",tag:"FOUNDATIONS",type:"text",content:`A stock represents a share of ownership in a company. When you buy a stock, you become a part-owner — called a shareholder — of that business.

If the company grows and becomes more profitable, the value of your shares typically rises. If it struggles or loses money, the value can fall. Companies sell stocks on public exchanges (like the NYSE or NASDAQ) to raise money for expansion, research, debt repayment, and more.

Every publicly traded company has a ticker symbol — a short code like AAPL (Apple), TSLA (Tesla), or NVDA (Nvidia). When you buy that ticker, you're buying a slice of that business.

KEY TERMS:
— Share: One unit of ownership in a company
— Market Cap: Total value of all shares (price × total shares)
— Dividend: A portion of profits paid to shareholders
— IPO: When a company first sells shares to the public`},
    {icon:"📊",title:"Stock Price & Volatility",tag:"PRICE ACTION",type:"text",content:`A stock's price is determined entirely by supply and demand — how many people want to buy versus how many want to sell at any given moment.

Volatility measures how much a stock's price swings over time. A high-volatility stock can gain or lose 5–10% in a single day. A low-volatility stock might barely move over weeks.

HIGH VOLATILITY:
— Greater risk, but greater potential reward
— Common in growth stocks, tech, biotech, and emerging companies
— News and earnings reports cause large moves

LOW VOLATILITY:
— Steadier, more predictable price movement
— Common in blue-chip stocks (large, established companies)
— Better suited for conservative investors`},
    {icon:"📈",title:"Bull vs. Bear Markets",tag:"MARKET CONDITIONS",type:"text",content:`A bull market is a period when stock prices are broadly rising — typically defined as a 20%+ gain from a recent low. Investors are confident, money is flowing in, and optimism drives prices higher.

A bear market is the opposite: a 20%+ decline from a recent high. Fear drives selling, prices fall, and even strong companies can see significant losses.

BULL MARKET SIGNS:
— Rising GDP and employment
— Companies reporting strong earnings
— High investor confidence

BEAR MARKET SIGNS:
— Economic slowdown or recession
— Rising interest rates or inflation concerns
— Mass selling and declining corporate profits`},
    {icon:"🔢",title:"Portfolio & Diversification",tag:"STRATEGY",type:"text",content:`Your portfolio is the full collection of all your investments. Diversification means spreading those investments across different companies and industries so a single bad event doesn't destroy your entire portfolio.

DIVERSIFICATION STRATEGIES:
— By Sector: Tech, healthcare, finance, energy, consumer goods
— By Size: Large-cap, mid-cap, small-cap stocks
— By Geography: US, international, emerging markets
— By Asset Class: Stocks, bonds, ETFs, commodities

A simple rule: no single stock should be more than 5–10% of your portfolio.`},
    {icon:"🗞️",title:"News & Market Impact",tag:"MARKET DYNAMICS",type:"text",content:`The market reacts to news — sometimes rationally, often emotionally.

TYPES OF NEWS THAT MOVE STOCKS:
— Earnings Reports: Quarterly results vs. analyst expectations
— Economic Data: Jobs reports, inflation numbers, GDP figures
— Federal Reserve: Interest rate decisions and policy signals
— Company Events: CEO changes, product launches, acquisitions, scandals
— Geopolitical Events: Wars, trade policy, elections

THE NEWS → PRICE CHAIN:
Positive surprise → More buyers than sellers → Price rises
Negative surprise → More sellers than buyers → Price falls

One critical insight: the market often prices in expected news before it happens. The actual price move depends on whether results beat or missed expectations.`},
    {icon:"⚖️",title:"Risk Management",tag:"FUNDAMENTALS",type:"text",content:`Every investment carries risk. Risk management is the set of strategies you use to limit how much you can lose.

CORE CONCEPTS:

Position Sizing: No single stock should be more than 5–10% of your portfolio.

Stop-Loss Orders: Set a price at which you automatically sell. Buy at $100, stop-loss at $85 = max 15% loss.

Risk/Reward Ratio: A 1:3 ratio means risking $100 to potentially gain $300.

Only Invest What You Can Afford to Lose: Never invest money needed for rent, bills, or emergencies.

Time Horizon: Long-term investors can ride out downturns. Short-term traders need tighter controls.`},
    {type:"indicator",icon:"📉",title:"MACD Indicator",tag:"TECHNICAL ANALYSIS",color:T.lime,
      subtitle:"Moving Average Convergence Divergence",
      overview:"The MACD is one of the most widely used momentum indicators in technical analysis. It shows the relationship between two moving averages of a stock's price — helping you identify trend direction, momentum strength, and potential reversal points.",
      howItWorks:[["MACD Line","Calculated by subtracting the 26-period EMA from the 12-period EMA. This is the faster line."],["Signal Line","A 9-period EMA of the MACD line itself. The one MACD crosses over or under."],["Histogram","The visual bar chart showing the difference between MACD and Signal. Expanding bars = growing momentum."]],
      signals:[{label:"Bullish Crossover",desc:"MACD crosses ABOVE signal line → potential buy signal.",col:"#00FF88"},{label:"Bearish Crossover",desc:"MACD crosses BELOW signal line → potential sell signal.",col:"#FF4444"},{label:"Zero Line Cross",desc:"Short-term average has crossed the long-term. Strong trend confirmation.",col:T.lime},{label:"Divergence",desc:"Price makes new highs but MACD doesn't → bearish divergence (potential reversal).",col:"#888"}],
      warning:"MACD is a lagging indicator — it follows price rather than predicting it. Never use it in isolation."
    },
    {type:"indicator",icon:"🌊",title:"Stock Price Volatility",tag:"RISK ASSESSMENT",color:"#FF8800",
      subtitle:"Measuring the Magnitude of Price Movement",
      overview:"Volatility is the degree of variation in a stock's price over time. It's one of the most important factors in determining how much risk you're taking on.",
      howItWorks:[["Standard Deviation","The primary mathematical measure of volatility. Higher = bigger average price swings."],["Beta","Compares stock volatility to the market (S&P 500 = 1.0). Beta of 1.5 = moves 50% more than market."],["ATR","Average True Range — measures average daily price range."],["VIX","The 'fear index' — measures implied volatility of the S&P 500."]],
      signals:[{label:"Low (Beta < 0.8)",desc:"Stable, predictable. Lower gains but more consistent.",col:"#00FF88"},{label:"Medium (Beta 0.8–1.2)",desc:"Moves roughly in line with the market.",col:T.lime},{label:"High (Beta > 1.5)",desc:"Large swings. Higher potential gains AND losses.",col:"#FF8800"},{label:"Extreme (Beta > 2.5)",desc:"Speculative — can double or halve in days.",col:"#FF4444"}],
      warning:"Always factor volatility into your position size — higher volatility means invest less per position."
    },
    {type:"indicator",icon:"⭐",title:"1–5 Buy/Sell Rating",tag:"SCORING SYSTEM",color:T.lime,
      subtitle:"How We Score Each Stock",
      overview:"Stocks Advisor generates a 1–5 rating from real Finnhub data — combining today's price change, position in the 52-week range, and beta adjustment. No guesswork.",
      howItWorks:[["Price Change","Today's % change vs previous close. Strong gains add to score, drops subtract."],["52-Week Position","Where the stock sits in its annual range. Near the high scores well; near the low scores poorly."],["Beta Adjustment","High-beta stocks get a slight penalty for elevated risk. Low-beta gets a slight boost."],["Final Score","Rounded to nearest 0.5. Ranges from 1 (Strong Sell) to 5 (Strong Buy)."]],
      signals:[{label:"5 — Strong Buy",desc:"Strong today + near 52-week high + low-medium beta.",col:"#00FF88"},{label:"4 — Buy",desc:"Positive momentum, healthy range position.",col:"#88CC00"},{label:"3 — Neutral",desc:"Mixed signals. Hold if you own it, wait if you don't.",col:T.lime},{label:"2 — Sell",desc:"Weak momentum or near 52-week low.",col:"#FF8800"},{label:"1 — Strong Sell",desc:"Significant decline + low range position.",col:"#FF4444"}],
      warning:"This rating is based on real price data but is for educational purposes only — NOT financial advice."
    },
    {type:"indicator",icon:"🔬",title:"Research Capabilities",tag:"PLATFORM FEATURES",color:"#A78BFA",
      subtitle:"What Stocks Advisor Provides",
      overview:"Stocks Advisor pulls live data from Finnhub's API — one of the most comprehensive free financial data providers. Here's what we surface for every stock.",
      howItWorks:[["Real-time Quote","Current price, today's change, open, high, low, and previous close."],["52-Week Range","Annual high and low — giving context on where the stock sits historically."],["Beta & Market Cap","Risk measure and company size from Finnhub's fundamental data."],["Live News","Real market news headlines from Finnhub's news feed, updated continuously."]],
      signals:[{label:"Quote Data",desc:"Live price + intraday OHLC from Finnhub's /quote endpoint.",col:"#A78BFA"},{label:"Company Profile",desc:"Name, sector, exchange, market cap from /stock/profile2.",col:T.lime},{label:"Key Metrics",desc:"52-week high/low, beta from /stock/metric.",col:"#00FF88"},{label:"Market News",desc:"Real headlines from /news with source, timestamp, and link.",col:"#FF8800"}],
      warning:"Data is sourced from Finnhub's free tier. Some metrics may be delayed by up to 15 minutes during market hours."
    },
  ];

  const topic=topics[active];
  const DIVIDER=6;
  return (
    <div style={{padding:"100px 0 80px",maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"270px 1fr",minHeight:"80vh"}}>
      <div style={{borderRight:`1px solid ${T.dkGrey}`,position:"sticky",top:88,alignSelf:"start",maxHeight:"calc(100vh - 88px)",overflowY:"auto"}}>
        <div style={{padding:"0 24px 20px",borderBottom:`1px solid ${T.dkGrey}`,marginBottom:8}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.lime,letterSpacing:3,textTransform:"uppercase"}}>STOCK BASICS + GUIDE</div>
        </div>
        {topics.map((t,i)=>{
          const ac=t.type==="indicator"?(t.color||T.lime):T.lime;
          return (
            <div key={i}>
              {i===DIVIDER&&(<div style={{padding:"14px 24px 8px",borderTop:`1px solid ${T.dkGrey}`,marginTop:8}}><div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,letterSpacing:3,textTransform:"uppercase"}}>── INDICATORS ──</div></div>)}
              <div onClick={()=>setActive(i)} style={{padding:"13px 24px",cursor:"pointer",borderLeft:active===i?`3px solid ${ac}`:"3px solid transparent",background:active===i?T.offBlk:"transparent",transition:"all 0.15s"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:active===i?ac:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:3}}>{t.tag}</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600,color:active===i?T.white:T.grey}}>{t.icon} {t.title}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div key={active} style={{padding:"0 56px 40px",animation:"fadeIn 0.25s ease"}}>
        {topic.type==="text"?(
          <>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>{topic.tag}</div>
            <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(28px,4vw,52px)",fontWeight:900,lineHeight:1.05,letterSpacing:-1,marginBottom:40,color:T.white}}>{topic.icon} {topic.title}</h1>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,lineHeight:1.85,color:T.grey,whiteSpace:"pre-line"}}>{topic.content}</div>
          </>
        ):(
          <>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:topic.color,letterSpacing:3,textTransform:"uppercase",marginBottom:12}}>{topic.tag}</div>
            <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(28px,4vw,52px)",fontWeight:900,lineHeight:1.0,letterSpacing:-1,marginBottom:4}}>{topic.icon} {topic.title}</h1>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.grey,marginBottom:28,letterSpacing:.5}}>{topic.subtitle}</div>
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,lineHeight:1.8,color:T.grey,marginBottom:44,maxWidth:640}}>{topic.overview}</p>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.white,letterSpacing:2,textTransform:"uppercase",marginBottom:16}}>HOW IT WORKS</div>
            <div style={{display:"grid",gap:1,marginBottom:44,border:`1px solid ${T.dkGrey}`}}>
              {topic.howItWorks.map(([k,v],i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"170px 1fr",borderBottom:i<topic.howItWorks.length-1?`1px solid ${T.dkGrey}`:"none"}}>
                  <div style={{padding:"15px 20px",borderRight:`1px solid ${T.dkGrey}`,background:T.offBlk}}><span style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:topic.color}}>{k}</span></div>
                  <div style={{padding:"15px 20px"}}><span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.6}}>{v}</span></div>
                </div>
              ))}
            </div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.white,letterSpacing:2,textTransform:"uppercase",marginBottom:16}}>SIGNAL GUIDE</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginBottom:36}}>
              {topic.signals.map((s,i)=>(
                <div key={i} style={{background:T.offBlk,border:`1px solid ${T.dkGrey}`,borderTop:`3px solid ${s.col}`,borderRadius:2,padding:"18px 16px"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,color:s.col,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>{s.label}</div>
                  <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.6}}>{s.desc}</div>
                </div>
              ))}
            </div>
            <div style={{background:`${topic.color}10`,border:`1px solid ${topic.color}44`,borderRadius:2,padding:"16px 20px",display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:15,flexShrink:0,marginTop:1}}>⚠️</span>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.7}}><span style={{color:topic.color,fontWeight:700}}>Important: </span>{topic.warning}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── NEWS ── */
function NewsPage() {
  const [loading,setLoading]=useState(true);
  const [articles,setArticles]=useState([]);
  const [err,setErr]=useState(null);
  const [filter,setFilter]=useState("All");

  useEffect(()=>{
    (async()=>{
      try {
        const data = await fh("news",{category:"general",minId:0});
        setArticles((data||[]).slice(0,24));
      } catch(e){ setErr("Failed to load news. Make sure FINNHUB_API_KEY is set in Vercel environment variables."); }
      setLoading(false);
    })();
  },[]);

  const cats=["All","general","forex","crypto","merger"];
  const filtered=filter==="All"?articles:articles.filter(a=>a.category===filter);

  function timeAgo(ts){
    const d=Math.floor((Date.now()/1000)-ts);
    if(d<3600) return`${Math.floor(d/60)}m ago`;
    if(d<86400) return`${Math.floor(d/3600)}h ago`;
    return`${Math.floor(d/86400)}d ago`;
  }

  return (
    <div style={{padding:"100px 48px 80px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:48,flexWrap:"wrap",gap:24}}>
        <div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>LIVE · FINNHUB</div>
          <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(32px,6vw,72px)",fontWeight:900,lineHeight:0.9,letterSpacing:-2}}>NEWS<br/><span style={{color:T.lime}}>UPDATES</span></h1>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {cats.map(s=>(
            <button key={s} onClick={()=>setFilter(s)} className="nav-btn" style={{background:filter===s?T.lime:"transparent",color:filter===s?T.black:T.grey,border:"none",borderRadius:4,padding:"6px 12px",cursor:"pointer",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1,fontWeight:700,textTransform:"uppercase",transition:"all 0.15s"}}>{s}</button>
          ))}
        </div>
      </div>
      {loading&&<div style={{textAlign:"center",padding:"80px 0"}}><div style={{fontSize:32,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:20}}>⚙️</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:T.grey,letterSpacing:1}}>FETCHING LIVE NEWS…</div></div>}
      {err&&<div style={{color:"#FF4444",fontFamily:"'Space Mono',monospace",fontSize:13,padding:"20px",background:"#FF444418",border:"1px solid #FF444444",borderRadius:4}}>{err}</div>}
      {!loading&&!err&&(
        <div style={{display:"grid",gap:1,border:`1px solid ${T.dkGrey}`}}>
          {filtered.map((a,i)=>(
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"grid",gridTemplateColumns:"90px 1fr",borderBottom:`1px solid ${T.dkGrey}`,background:T.black,transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=T.offBlk} onMouseLeave={e=>e.currentTarget.style.background=T.black}>
              <div style={{borderRight:`1px solid ${T.dkGrey}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"16px 10px"}}>
                {a.image?(<img src={a.image} alt="" style={{width:60,height:44,objectFit:"cover",borderRadius:2,opacity:.8}} onError={e=>e.target.style.display="none"}/>):(<div style={{width:60,height:44,background:T.dkGrey,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:18}}>📰</span></div>)}
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textAlign:"center",lineHeight:1.3}}>{a.source}</div>
              </div>
              <div style={{padding:"20px 24px"}}>
                <div style={{display:"flex",gap:10,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
                  {a.related&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,color:T.lime}}>{a.related}</span>}
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,textTransform:"uppercase",letterSpacing:1}}>{a.category}</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,marginLeft:"auto"}}>{timeAgo(a.datetime)}</span>
                </div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,fontWeight:700,color:T.white,marginBottom:6,lineHeight:1.35}}>{a.headline}</div>
                {a.summary&&<div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:12,color:T.grey,lineHeight:1.6}}>{a.summary.slice(0,180)}{a.summary.length>180?"…":""}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
      {!loading&&!err&&filtered.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:T.grey,fontFamily:"'Space Mono',monospace",fontSize:12}}>No articles in this category right now.</div>}
    </div>
  );
}

/* ─────────────────────────────────────── INDICATORS ── */
function IndicatorsPage() {
  const [ticker,setTicker]=useState("");
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [err,setErr]=useState(null);

  const analyze=useCallback(async()=>{
    if(!ticker.trim()||loading) return;
    setLoading(true); setData(null); setErr(null);
    const sym=ticker.trim().toUpperCase();
    try {
      const [q,profile,metric]=await Promise.all([
        fh("quote",{symbol:sym}),
        fh("stock/profile2",{symbol:sym}),
        fh("stock/metric",{symbol:sym,metric:"all"}),
      ]);
      if(!q||q.c==null||q.c===0) throw new Error("No data — check ticker symbol");
      setData({q,profile,metric,sym});
    } catch(e){ setErr(e.message||"Failed to fetch data. Check the ticker symbol and try again."); }
    setLoading(false);
  },[ticker,loading]);

  const rCol=(s)=>s==="Strong Buy"||s==="Buy"?"#00FF88":s==="Strong Sell"||s==="Sell"?"#FF4444":T.lime;
  const vCol=(l)=>l==="Low"?"#00FF88":l==="Medium"?T.lime:l==="High"?"#FF8800":"#FF4444";
  const mCol=(s)=>s?.includes("Bullish")?"#00FF88":s?.includes("Bearish")?"#FF4444":T.lime;
  const scoreN=(n)=>n>=4?"#00FF88":n>=3?T.lime:"#FF4444";

  let analysis=null;
  if(data){
    const {q,metric}=data;
    const {score,label}=scoreStock(q,metric);
    const macd=macdSignal(q);
    const beta=metric?.metric?.beta;
    const vl=volLevel(beta);
    const high52=metric?.metric?.["52WeekHigh"];
    const low52=metric?.metric?.["52WeekLow"];
    const range=high52&&low52?high52-low52:null;
    const posInRange=range&&range>0?((q.c-low52)/range*100).toFixed(0):null;
    analysis={score,label,macd,vl,beta,high52,low52,posInRange};
  }

  return (
    <div style={{padding:"100px 48px 80px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:56}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>LIVE · FINNHUB</div>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(32px,6vw,72px)",fontWeight:900,lineHeight:0.9,letterSpacing:-2,marginBottom:16}}>INDICATORS<br/><span style={{color:T.lime}}>DASHBOARD</span></h1>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,color:T.grey,maxWidth:520,lineHeight:1.6}}>Real Finnhub market data. Enter any US stock ticker for a live quote, 52-week range, beta, volatility rating, MACD signal, and buy/sell score.</p>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:20,maxWidth:560}}>
        <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&analyze()}
          placeholder="e.g. AAPL, TSLA, NVDA, MSFT"
          style={{flex:1,background:T.offBlk,border:`1px solid ${T.dkGrey}`,color:T.white,borderRadius:4,padding:"13px 18px",fontSize:15,fontFamily:"'Space Mono',monospace",fontWeight:700,outline:"none",letterSpacing:1,transition:"border-color 0.15s"}}
          onFocus={e=>e.target.style.borderColor=T.lime} onBlur={e=>e.target.style.borderColor=T.dkGrey}
        />
        <button onClick={analyze} disabled={loading||!ticker.trim()} className="lime-btn" style={{background:loading||!ticker.trim()?T.dkGrey:T.lime,color:loading||!ticker.trim()?T.grey:T.black,border:"none",borderRadius:4,padding:"13px 24px",fontWeight:700,fontSize:12,fontFamily:"'Space Mono',monospace",cursor:loading||!ticker.trim()?"default":"pointer",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s",flexShrink:0}}>
          {loading?"…":"ANALYZE"}
        </button>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:48,flexWrap:"wrap"}}>
        {["AAPL","TSLA","NVDA","MSFT","AMZN","META","GOOGL","JPM"].map(s=>(
          <button key={s} onClick={()=>setTicker(s)} style={{background:"transparent",border:`1px solid ${T.dkGrey}`,color:T.grey,borderRadius:3,padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:.5,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.lime;e.currentTarget.style.color=T.lime;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.dkGrey;e.currentTarget.style.color=T.grey;}}>{s}</button>
        ))}
      </div>

      {loading&&<div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:32,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:16}}>⚙️</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:T.grey,letterSpacing:1}}>FETCHING LIVE DATA FROM FINNHUB…</div></div>}
      {err&&<div style={{color:"#FF4444",fontFamily:"'Space Mono',monospace",fontSize:13,padding:"20px",background:"#FF444418",border:"1px solid #FF444444",borderRadius:4}}>{err}</div>}

      {data&&analysis&&!loading&&(
        <div style={{animation:"fadeIn 0.5s ease"}}>
          {/* Live quote bar */}
          <div style={{background:T.offBlk,border:`1px solid ${T.dkGrey}`,borderRadius:2,padding:"20px 28px",marginBottom:2,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:28,fontWeight:700,color:T.lime,lineHeight:1}}>{data.sym}</div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,color:T.grey,marginTop:3}}>{data.profile?.name||data.sym} · {data.profile?.finnhubIndustry||""}</div>
            </div>
            <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:28,fontWeight:700,color:T.white}}>${fmt(data.q.c)}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:13,color:(data.q.dp??0)>=0?"#00FF88":"#FF4444"}}>{fmtChg(data.q.dp)} (${fmt(data.q.d)})</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[["Open",`$${fmt(data.q.o)}`],["High",`$${fmt(data.q.h)}`],["Low",`$${fmt(data.q.l)}`],["Prev Close",`$${fmt(data.q.pc)}`]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,textTransform:"uppercase",letterSpacing:1,width:60}}>{k}</span>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.white,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[
                  ["52W High",`$${fmt(analysis.high52)}`],
                  ["52W Low",`$${fmt(analysis.low52)}`],
                  ["Beta",analysis.beta!=null?Number(analysis.beta).toFixed(2):"N/A"],
                  ["Mkt Cap",fmtLarge(data.profile?.marketCapitalization)],
                ].map(([k,v])=>(
                  <div key={k} style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,textTransform:"uppercase",letterSpacing:1,width:60}}>{k}</span>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:1}}>LIVE · FINNHUB</div>
          </div>

          {/* 52-week range bar */}
          {analysis.posInRange!=null&&(
            <div style={{background:T.offBlk,border:`1px solid ${T.dkGrey}`,padding:"16px 28px",marginBottom:2}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>52-WEEK RANGE POSITION</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.grey,flexShrink:0}}>${fmt(analysis.low52)}</span>
                <div style={{flex:1,height:6,background:T.dkGrey,borderRadius:3,position:"relative"}}>
                  <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${analysis.posInRange}%`,background:`linear-gradient(to right, #FF4444, ${T.lime})`,borderRadius:3}}/>
                  <div style={{position:"absolute",top:-4,width:14,height:14,background:T.lime,borderRadius:"50%",border:`2px solid ${T.black}`,left:`calc(${analysis.posInRange}% - 7px)`}}/>
                </div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.grey,flexShrink:0}}>${fmt(analysis.high52)}</span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,fontWeight:700,flexShrink:0}}>{analysis.posInRange}%</span>
              </div>
            </div>
          )}

          {/* 4-panel grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,border:`1px solid ${T.dkGrey}`,marginBottom:2}}>
            {/* MACD */}
            <div style={{padding:"28px",borderRight:`1px solid ${T.dkGrey}`,borderBottom:`1px solid ${T.dkGrey}`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>📉 MACD SIGNAL</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {[{l:"Signal",v:analysis.macd.signal,c:mCol(analysis.macd.signal)},{l:"Trend",v:analysis.macd.trend,c:analysis.macd.trend==="Uptrend"?"#00FF88":analysis.macd.trend==="Downtrend"?"#FF4444":T.lime},{l:"Histogram",v:analysis.macd.histogram,c:T.grey}].map((b,i)=>(
                  <div key={i} style={{background:`${b.c}14`,border:`1px solid ${b.c}44`,borderRadius:3,padding:"6px 10px"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{b.l}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:b.c}}>{b.v}</div>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65}}>
                {analysis.macd.signal==="Bullish Crossover"
                  ?`${data.sym} is showing bullish momentum today with a ${fmtChg(data.q.dp)} move and price above intraday midpoint. MACD-style signal suggests upward pressure.`
                  :analysis.macd.signal==="Bearish Crossover"
                  ?`${data.sym} is showing bearish momentum with a ${fmtChg(data.q.dp)} move and price below intraday midpoint. MACD-style signal suggests downward pressure.`
                  :`${data.sym} is trading with mixed momentum today (${fmtChg(data.q.dp)}). No strong directional signal — consolidation phase.`
                }
              </div>
            </div>

            {/* Volatility */}
            <div style={{padding:"28px",borderBottom:`1px solid ${T.dkGrey}`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>🌊 VOLATILITY</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <div style={{background:`${vCol(analysis.vl)}14`,border:`1px solid ${vCol(analysis.vl)}44`,borderRadius:3,padding:"6px 10px"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Level</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:vCol(analysis.vl)}}>{analysis.vl}</div>
                </div>
                <div style={{background:"#ffffff14",border:"1px solid #ffffff44",borderRadius:3,padding:"6px 10px"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Beta</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:T.white}}>{analysis.beta!=null?Number(analysis.beta).toFixed(2):"N/A"}</div>
                </div>
              </div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65}}>
                {analysis.beta!=null
                  ?`With a beta of ${Number(analysis.beta).toFixed(2)}, ${data.sym} is classified as ${analysis.vl.toLowerCase()} volatility. ${analysis.vl==="Low"?"Moves less than the broader market — suitable for conservative investors.":analysis.vl==="Medium"?"Moves roughly in line with the market.":analysis.vl==="High"?"Larger swings than the market — higher risk and reward potential.":"Highly speculative with extreme price swings."}`
                  :`Beta data not available for ${data.sym}. Exercise caution sizing this position.`
                }
              </div>
            </div>

            {/* Rating */}
            <div style={{padding:"28px",borderRight:`1px solid ${T.dkGrey}`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>⭐ BUY/SELL RATING</div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:48,fontWeight:700,color:rCol(analysis.label),lineHeight:1}}>{analysis.score}<span style={{fontSize:20,color:T.grey}}>/5</span></div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:14,fontWeight:700,color:rCol(analysis.label)}}>{analysis.label}</div>
              </div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65}}>
                Score based on: today's change ({fmtChg(data.q.dp)}), 52-week range position ({analysis.posInRange??"-"}%), and beta adjustment. Pure Finnhub data — no guesswork.
              </div>
            </div>

            {/* Company profile */}
            <div style={{padding:"28px"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>🔬 COMPANY PROFILE</div>
              {[
                ["Name",data.profile?.name||"—"],
                ["Sector",data.profile?.finnhubIndustry||"—"],
                ["Exchange",data.profile?.exchange||"—"],
                ["Market Cap",fmtLarge(data.profile?.marketCapitalization)],
                ["Country",data.profile?.country||"—"],
                ["IPO Date",data.profile?.ipo||"—"],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.dkGrey}`}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.grey,textTransform:"uppercase",letterSpacing:.5}}>{k}</span>
                  <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:12,color:T.white,fontWeight:600,textAlign:"right",maxWidth:"60%"}}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,color:T.grey,textAlign:"center",padding:"12px",border:`1px solid ${T.dkGrey}`,borderRadius:2}}>
            ⚠️ Data sourced from Finnhub. Ratings and signals are for educational purposes only — not financial advice. Always do your own research.
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── AI ADVISOR (no API — smart FAQ) ── */
const FAQ = [
  {q:"What is a stock?",a:"A stock is a share of ownership in a company. When you buy one, you become a part-owner (shareholder). If the company grows, your shares increase in value. They trade on exchanges like the NYSE or NASDAQ under a ticker symbol — like AAPL for Apple."},
  {q:"What is the MACD indicator?",a:"MACD (Moving Average Convergence Divergence) shows momentum by comparing two moving averages. When the MACD line crosses above the signal line → bullish signal. When it crosses below → bearish. On this site, we estimate MACD direction from intraday price action."},
  {q:"What is a bull vs bear market?",a:"A bull market = prices broadly rising 20%+ from a recent low. Optimism, strong earnings, job growth. A bear market = prices down 20%+ from a recent high. Fear, selling pressure, economic slowdown. Knowing which you're in shapes your whole strategy."},
  {q:"How should I diversify my portfolio?",a:"Spread investments across: sectors (tech, healthcare, finance, energy), company sizes (large, mid, small cap), geographies (US, international), and asset types (stocks, bonds, ETFs). A basic rule: no single stock should exceed 5–10% of your portfolio."},
  {q:"What does a P/E ratio mean?",a:"Price-to-Earnings ratio = stock price ÷ earnings per share. A P/E of 20 means you're paying $20 for every $1 of annual earnings. High P/E = investors expect high growth. Low P/E = may be undervalued or a struggling company. Context matters — compare P/E within the same sector."},
  {q:"How do I read a stock quote?",a:"A quote shows: Current Price (c), Change from yesterday (d/dp%), Today's Open (o), High (h), Low (l), and Previous Close (pc). On the Indicators page, Stocks Advisor shows all of this in real time from Finnhub for any ticker you enter."},
  {q:"What is beta?",a:"Beta measures how much a stock moves relative to the market. Beta = 1.0 means it moves with the S&P 500. Beta = 1.5 means 50% more volatile. Beta = 0.5 means half as volatile. High beta = higher risk AND reward potential. We show beta on every stock analysis."},
  {q:"What is a 52-week high/low?",a:"The highest and lowest price a stock has traded at in the past year. If a stock is near its 52-week high, it's performing well but may be overbought. Near its 52-week low may suggest weakness — or a buying opportunity. Our range bar shows exactly where it sits."},
  {q:"What does volatility mean?",a:"Volatility = how much a stock's price swings. High volatility stocks can move 5-10% in a day (TSLA, NVDA). Low volatility stocks barely move (utilities, consumer staples). We classify volatility as Low / Medium / High / Extreme using the stock's beta."},
  {q:"How is the 1-5 rating calculated?",a:"Our score uses real Finnhub data: today's % change (strong gains add points, drops subtract), 52-week range position (near the high scores well, near the low scores poorly), and beta adjustment (very high beta slightly reduces score for risk). No AI, no guesswork — pure market data."},
  {q:"What is market cap?",a:"Market capitalization = total stock price × total shares outstanding. It tells you the company's total value. Large-cap ($10B+): Apple, Microsoft — stable. Mid-cap ($2-10B): solid growth potential. Small-cap (<$2B): higher risk, higher reward potential."},
  {q:"Should I buy Tesla right now?",a:"We can't tell you whether to buy any specific stock — that depends on your financial situation, risk tolerance, and goals. What we CAN do: head to the Indicators page, search TSLA, and you'll get a live quote, 52-week range position, volatility rating, and a data-driven score. Always pair that with your own research."},
];

function AIAdvisorPage() {
  const [messages,setMessages]=useState([
    {role:"assistant",content:"Hey! I'm your Stocks Advisor guide. I can answer common questions about stocks, explain how our indicators work, or walk you through concepts. Type a question below or tap one of the suggestions!"}
  ]);
  const [input,setInput]=useState("");
  const bottomRef=useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  function getAnswer(q) {
    const lower=q.toLowerCase();
    // Find best matching FAQ
    let best=null, bestScore=0;
    for(const f of FAQ){
      const words=f.q.toLowerCase().split(/\s+/);
      const score=words.filter(w=>w.length>3&&lower.includes(w)).length;
      if(score>bestScore){bestScore=score;best=f;}
    }
    // Also check for keyword triggers
    if(lower.includes("macd")) return FAQ.find(f=>f.q.includes("MACD"))?.a;
    if(lower.includes("bull")||lower.includes("bear")) return FAQ.find(f=>f.q.includes("bull"))?.a;
    if(lower.includes("p/e")||lower.includes("pe ratio")) return FAQ.find(f=>f.q.includes("P/E"))?.a;
    if(lower.includes("beta")) return FAQ.find(f=>f.q.includes("beta"))?.a;
    if(lower.includes("52")||lower.includes("52-week")) return FAQ.find(f=>f.q.includes("52-week"))?.a;
    if(lower.includes("volatil")) return FAQ.find(f=>f.q.includes("volatility"))?.a;
    if(lower.includes("diversif")) return FAQ.find(f=>f.q.includes("diversif"))?.a;
    if(lower.includes("market cap")) return FAQ.find(f=>f.q.includes("market cap"))?.a;
    if(lower.includes("rating")||lower.includes("score")||lower.includes("1-5")||lower.includes("buy/sell")) return FAQ.find(f=>f.q.includes("1-5"))?.a;
    if(lower.includes("quote")||lower.includes("read")) return FAQ.find(f=>f.q.includes("quote"))?.a;
    if(lower.includes("stock")&&lower.includes("what")) return FAQ.find(f=>f.q==="What is a stock?")?.a;
    if(bestScore>=2) return best?.a;
    return "Great question! I'm a knowledge-base guide focused on stock market concepts. Try asking about: MACD, volatility, beta, P/E ratio, bull/bear markets, diversification, the buy/sell rating, or how to read a stock quote. For live data on any specific ticker, head to the Indicators page!";
  }

  function send() {
    const q=input.trim();
    if(!q) return;
    const answer=getAnswer(q);
    setMessages(prev=>[...prev,{role:"user",content:q},{role:"assistant",content:answer}]);
    setInput("");
  }

  const SUGGESTIONS=["What is a stock?","How does MACD work?","What is beta?","Explain bull vs bear markets","How is the 1-5 rating calculated?","What does the 52-week range mean?"];

  return (
    <div style={{padding:"100px 0 0",maxWidth:900,margin:"0 auto",display:"flex",flexDirection:"column",height:"calc(100vh - 88px)"}}>
      <div style={{padding:"0 32px 24px",borderBottom:`1px solid ${T.dkGrey}`,flexShrink:0}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>STOCKS ADVISOR</div>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(24px,4vw,44px)",fontWeight:900,lineHeight:1,letterSpacing:-1}}>KNOWLEDGE <span style={{color:T.lime}}>GUIDE</span></h1>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,marginTop:6}}>Ask about stock concepts, indicators, and how Stocks Advisor works.</p>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"24px 32px",display:"flex",flexDirection:"column",gap:20}}>
        {messages.map((m,i)=>{
          const isUser=m.role==="user";
          return (
            <div key={i} style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start",animation:"fadeUp 0.3s ease"}}>
              {!isUser&&<div style={{width:28,height:28,background:T.lime,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:12,marginTop:2,alignSelf:"flex-start"}}><span style={{fontSize:12,fontWeight:900,color:T.black}}>SA</span></div>}
              <div style={{maxWidth:"75%",padding:"14px 18px",background:isUser?T.dkGrey:T.offBlk,border:`1px solid ${isUser?T.mdGrey:T.dkGrey}`,borderRadius:isUser?"12px 12px 2px 12px":"2px 12px 12px 12px",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,lineHeight:1.75,color:T.white,whiteSpace:"pre-wrap"}}>{m.content}</div>
              {isUser&&<div style={{width:28,height:28,background:T.dkGrey,border:`1px solid ${T.mdGrey}`,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12,marginTop:2,alignSelf:"flex-start"}}><span style={{fontSize:12,color:T.grey}}>U</span></div>}
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"0 32px 12px",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
        {SUGGESTIONS.map(s=>(
          <button key={s} onClick={()=>setInput(s)} style={{background:"transparent",border:`1px solid ${T.dkGrey}`,color:T.grey,borderRadius:20,padding:"6px 14px",fontSize:11,fontFamily:"'Space Mono',monospace",cursor:"pointer",transition:"all 0.15s",letterSpacing:.5}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.lime;e.currentTarget.style.color=T.lime;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.dkGrey;e.currentTarget.style.color=T.grey;}}>{s}</button>
        ))}
      </div>
      <div style={{padding:"12px 32px 24px",borderTop:`1px solid ${T.dkGrey}`,flexShrink:0,display:"flex",gap:12,alignItems:"flex-end"}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") send();}}
          placeholder="Ask about a stock concept… (Enter to send)"
          style={{flex:1,background:T.offBlk,border:`1px solid ${T.dkGrey}`,color:T.white,borderRadius:4,padding:"12px 16px",fontSize:14,fontFamily:"'Space Grotesk',sans-serif",outline:"none",transition:"border-color 0.15s"}}
          onFocus={e=>e.target.style.borderColor=T.lime} onBlur={e=>e.target.style.borderColor=T.dkGrey}
        />
        <button onClick={send} disabled={!input.trim()} className="lime-btn" style={{background:!input.trim()?T.dkGrey:T.lime,color:!input.trim()?T.grey:T.black,border:"none",borderRadius:4,padding:"12px 22px",fontWeight:700,fontSize:12,fontFamily:"'Space Mono',monospace",cursor:!input.trim()?"default":"pointer",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s",flexShrink:0}}>ASK</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── FOOTER ── */
function Footer({setPage}) {
  return (
    <footer style={{borderTop:`1px solid ${T.dkGrey}`,padding:"48px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,alignItems:"start"}}>
      <div>
        <div style={{fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:16,marginBottom:6}}><span style={{color:T.white}}>STOCKS </span><span style={{color:T.lime}}>ADVISOR</span></div>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.7,maxWidth:280}}>Real-time stock intelligence powered by Finnhub. For educational purposes only — not financial advice.</div>
        <div style={{marginTop:20,fontFamily:"'Space Mono',monospace",fontSize:10,color:T.grey,letterSpacing:1}}>CREATED BY AROMA MAHBUB &amp; ANIKAIT DATTA</div>
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end",alignItems:"flex-start"}}>
        {PAGES.map(p=>(
          <button key={p} onClick={()=>setPage(p)} style={{background:"transparent",border:`1px solid ${T.dkGrey}`,color:T.grey,borderRadius:2,padding:"6px 14px",cursor:"pointer",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.lime;e.currentTarget.style.color=T.lime;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.dkGrey;e.currentTarget.style.color=T.grey;}}>{p}</button>
        ))}
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────── APP ROOT ── */
export default function App() {
  const [page,setPage]=useState("Home");
  const changePage=(p)=>{setPage(p);window.scrollTo(0,0);};
  return (
    <div style={{background:T.black,color:T.white,minHeight:"100vh",fontFamily:"'Space Grotesk',sans-serif"}}>
      <style>{GLOBAL_CSS}</style>
      <Nav page={page} setPage={changePage}/>
      <Ticker/>
      <div style={{paddingTop:88}}>
        {page==="Home"         &&<HomePage      setPage={changePage}/>}
        {page==="How It Works" &&<HowItWorksPage/>}
        {page==="Stock Basics" &&<StockBasicsPage/>}
        {page==="News Updates" &&<NewsPage/>}
        {page==="Indicators"   &&<IndicatorsPage/>}
        {page==="AI Advisor"   &&<AIAdvisorPage/>}
        {page!=="AI Advisor"   &&<Footer setPage={changePage}/>}
      </div>
    </div>
  );
}
