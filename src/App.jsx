import { useState, useEffect, useRef, useCallback } from "react";

/* ─── DESIGN TOKENS ──────────────────────────────────────────────────────── */
const T = {
  black:   "#0A0A0A",
  offBlk:  "#111111",
  lime:    "#CCFF00",
  limeDim: "#99CC00",
  white:   "#FFFFFF",
  grey:    "#888888",
  dkGrey:  "#222222",
  mdGrey:  "#333333",
};

/* ─── GLOBAL CSS ─────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #0A0A0A; color: #fff; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0A0A0A; }
  ::-webkit-scrollbar-thumb { background: #CCFF00; }
  input, textarea { font-family: inherit; }
  input::placeholder, textarea::placeholder { color: #555; }

  @keyframes ticker   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes fadeUp   { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes pulse    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
  @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes glitch1  {
    0%,100%{clip-path:inset(0 0 95% 0);transform:translateX(0)}
    20%{clip-path:inset(30% 0 50% 0);transform:translateX(-4px)}
    40%{clip-path:inset(60% 0 20% 0);transform:translateX(4px)}
    60%{clip-path:inset(10% 0 80% 0);transform:translateX(-2px)}
    80%{clip-path:inset(80% 0 5% 0);transform:translateX(2px)}
  }
  @keyframes glitch2  {
    0%,100%{clip-path:inset(90% 0 0 0);transform:translateX(0)}
    20%{clip-path:inset(50% 0 30% 0);transform:translateX(4px)}
    40%{clip-path:inset(20% 0 60% 0);transform:translateX(-4px)}
    60%{clip-path:inset(70% 0 10% 0);transform:translateX(2px)}
    80%{clip-path:inset(5% 0 85% 0);transform:translateX(-2px)}
  }

  .nav-btn:hover  { background: #CCFF00 !important; color: #000 !important; }
  .card-hover:hover { border-color: #CCFF00 !important; }
  .lime-btn:hover { background: #fff !important; color: #000 !important; }
  .ghost-btn:hover { background: #CCFF00 !important; color: #000 !important; border-color: #CCFF00 !important; }
`;

/* ─── FINNHUB HELPER ─────────────────────────────────────────────────────── */
// All Finnhub calls go through /api/finnhub so the key stays server-side
async function finnhub(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`/api/finnhub?${qs}`);
  if (!res.ok) throw new Error(`Finnhub error ${res.status}`);
  return res.json();
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
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

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(2);
}
function fmtChg(n) {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

/* ─── LIVE TICKER ────────────────────────────────────────────────────────── */
const TICKER_SYMS = ["AAPL","TSLA","NVDA","MSFT","AMZN","GOOGL","META","JPM","V","BRK.B"];

function Ticker() {
  const [quotes, setQuotes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const results = await Promise.all(
          TICKER_SYMS.map(s => finnhub("quote", { symbol: s }).then(d => ({
            s,
            p: d.c != null ? d.c.toFixed(2) : "—",
            chg: d.dp != null ? fmtChg(d.dp) : "—",
            up: (d.dp ?? 0) >= 0,
          })).catch(() => ({ s, p: "—", chg: "—", up: true })))
        );
        if (!cancelled) setQuotes(results);
      } catch (e) { /* silent — fallback to empty */ }
    }
    load();
    const t = setInterval(load, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // While loading show placeholders
  const items = quotes.length ? quotes : TICKER_SYMS.map(s => ({ s, p: "…", chg: "", up: true }));

  return (
    <div style={{overflow:"hidden",borderBottom:`1px solid ${T.dkGrey}`,background:T.offBlk,padding:"7px 0",position:"fixed",top:52,left:0,right:0,zIndex:90}}>
      <div style={{display:"flex",gap:56,animation:"ticker 32s linear infinite",whiteSpace:"nowrap",width:"max-content"}}>
        {[...items,...items].map((t,i)=>(
          <span key={i} style={{fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:.5}}>
            <span style={{color:T.lime,fontWeight:700}}>{t.s}</span>{" "}
            <span style={{color:T.white}}>{t.p !== "—" ? `$${t.p}` : "—"}</span>{" "}
            <span style={{color:t.up?"#00FF88":"#FF4444"}}>{t.chg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── NAV ────────────────────────────────────────────────────────────────── */
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
          <button key={p} className="nav-btn" onClick={()=>setPage(p)} style={{
            background:page===p?T.lime:"transparent",
            color:page===p?T.black:T.grey,
            border:"none",borderRadius:4,
            padding:"5px 12px",cursor:"pointer",
            fontSize:11,fontWeight:700,fontFamily:"'Space Mono',monospace",
            letterSpacing:.5,transition:"all 0.15s",textTransform:"uppercase",
          }}>{p}</button>
        ))}
      </div>
    </nav>
  );
}

/* ─── GLITCH TEXT ────────────────────────────────────────────────────────── */
function GlitchText({text,style={}}) {
  return (
    <div style={{position:"relative",display:"inline-block",...style}}>
      <span style={{position:"relative",zIndex:2}}>{text}</span>
      <span aria-hidden style={{position:"absolute",inset:0,color:T.lime,animation:"glitch1 3s infinite 0.5s",zIndex:1}}>{text}</span>
      <span aria-hidden style={{position:"absolute",inset:0,color:"#FF0066",animation:"glitch2 3s infinite 1s",zIndex:1}}>{text}</span>
    </div>
  );
}

/* ─── MINI BAR CHART ─────────────────────────────────────────────────────── */
function MiniBarChart({vis}) {
  const bars = [35,55,40,70,50,80,60,90,72,85,65,95];
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80}}>
      {bars.map((h,i)=>(
        <div key={i} style={{
          width:16,background:i===bars.length-1?T.lime:T.dkGrey,
          height:vis?`${h}%`:"0%",transition:`height 0.6s ease ${i*60}ms`,
          borderRadius:"2px 2px 0 0",flexShrink:0,
        }}/>
      ))}
    </div>
  );
}

/* ─── HOME PAGE ──────────────────────────────────────────────────────────── */
function HomePage({setPage}) {
  const [ref,vis] = useInView(0.01);
  const [statsRef,statsVis] = useInView();
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
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:16,lineHeight:1.7,color:T.grey,marginBottom:28}}>A user-friendly AI-powered website that provides all the info you need about stocks, regardless of skill level. From absolute beginners to professionals — Stocks Advisor is the site for everyone.</p>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <button className="lime-btn" onClick={()=>setPage("AI Advisor")} style={{background:T.lime,color:T.black,border:"none",borderRadius:4,padding:"13px 28px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Space Mono',monospace",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s"}}>TRY AI ADVISOR →</button>
              <button className="ghost-btn" onClick={()=>setPage("Stock Basics")} style={{background:"transparent",color:T.white,border:`1px solid ${T.dkGrey}`,borderRadius:4,padding:"13px 28px",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Space Mono',monospace",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s"}}>LEARN BASICS</button>
            </div>
          </div>
          <div ref={statsRef} style={{display:"flex",gap:32,flexWrap:"wrap"}}>
            <MiniBarChart vis={statsVis}/>
            <div style={{display:"flex",flexDirection:"column",gap:16,justifyContent:"flex-end"}}>
              {[["8,500+","Stocks tracked"],["94%","AI accuracy"],["120+","News sources"]].map(([n,l])=>(
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

      <section style={{borderTop:`1px solid ${T.dkGrey}`,borderBottom:`1px solid ${T.dkGrey}`,padding:"0",overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))"}}>
          {[{icon:"📊",label:"MACD Indicator"},{icon:"📰",label:"News Updates"},{icon:"⭐",label:"1–5 Buy/Sell Rating"},{icon:"📈",label:"Price Volatility"},{icon:"🔬",label:"AI Research"},{icon:"🎓",label:"Learning Guides"}].map((f,i)=>(
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
            <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,lineHeight:1.8,color:T.grey}}>We built Stocks Advisor to represent our own twist on how AI can help everyone engage with a part of the financial world that often goes unnoticed due to misinformation and vague information. Stocks Advisor AI provides the necessary information and factors to help the user find the best pathway for success.</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0,border:`1px solid ${T.dkGrey}`,borderRadius:2}}>
            {[["Created by","Aroma Mahbub & Anikait Datta"],["Project","Track 1 — AI in Finance"],["Goal","Demystify stock investing"],["Powered by","Claude AI + Finnhub Market Data"]].map(([k,v],i)=>(
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:1,border:`1px solid ${T.dkGrey}`,maxWidth:1000,margin:"0 auto"}}>
          {[{p:"How It Works",icon:"⚙️",desc:"See the AI pipeline from watchlist to output"},{p:"Stock Basics",icon:"📚",desc:"Ground-up education — concepts, strategies & indicators"},{p:"News Updates",icon:"🗞️",desc:"Live market news from Finnhub"},{p:"Indicators",icon:"📊",desc:"Live technical analysis powered by real market data"},{p:"AI Advisor",icon:"🤖",desc:"Ask our AI anything about stocks"}].map(({p,icon,desc})=>(
            <div key={p} onClick={()=>setPage(p)} className="card-hover" style={{background:T.offBlk,padding:"36px 28px",cursor:"pointer",borderRight:`1px solid ${T.dkGrey}`,transition:"all 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.background=T.dkGrey;}} onMouseLeave={e=>{e.currentTarget.style.background=T.offBlk;}}>
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

/* ─── HOW IT WORKS ───────────────────────────────────────────────────────── */
function HowItWorksPage() {
  const steps = [
    {n:"01",icon:"📋",title:"Watchlist / Portfolio",desc:"Select the stocks you want to follow. The AI also suggests promising tickers based on current market momentum and sector trends.",color:T.lime},
    {n:"02",icon:"🔍",title:"Research",desc:"Our AI searches through dozens of credible financial news sources — Reuters, Bloomberg feeds, SEC filings — gathering the most recent and relevant news for each stock.",color:T.white},
    {n:"03",icon:"📡",title:"Market Data Pull",desc:"Real-time data is fetched from Finnhub: current prices, historical volatility scores, 52-week highs/lows, volume spikes, and sector performance context.",color:T.lime},
    {n:"04",icon:"🤖",title:"AI Analysis",desc:"Claude AI synthesizes research and market data to draw actionable conclusions — connecting news events to price action and assessing fundamental outlook.",color:T.white},
    {n:"05",icon:"📤",title:"Output",desc:"You receive a score out of 5 on investment strength, a clear news summary, and a concise analysis paragraph written in plain English — no jargon.",color:T.lime},
    {n:"06",icon:"📉",title:"MACD Entry Point",desc:"The MACD indicator highlights estimated trade entry and exit points. An additional technical signal to confirm or question your timing — always interpret with caution.",color:T.white},
  ];
  return (
    <div style={{padding:"100px 48px 80px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{marginBottom:72}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>THE PIPELINE</div>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(36px,7vw,80px)",fontWeight:900,lineHeight:0.95,letterSpacing:-2}}>HOW IT<br/><span style={{color:T.lime}}>WORKS</span></h1>
      </div>
      <div style={{display:"grid",gap:1}}>
        {steps.map((s,i)=>{
          const [ref,vis] = useInView();
          return (
            <div ref={ref} key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:0,borderTop:`1px solid ${T.dkGrey}`,opacity:vis?1:0,transform:vis?"translateX(0)":"translateX(-24px)",transition:`all 0.5s ease ${i*80}ms`}}>
              <div style={{padding:"28px 24px",borderRight:`1px solid ${T.dkGrey}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.grey,letterSpacing:1}}>{s.n}</span>
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
      <div style={{marginTop:80,padding:"48px",background:T.offBlk,border:`1px solid ${T.dkGrey}`,borderRadius:2}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:32}}>VISUAL FLOW</div>
        <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
          {["WATCHLIST","→","RESEARCH","→","MARKET DATA","→","AI ANALYSIS","→","OUTPUT","→","MACD SIGNAL"].map((s,i)=>(
            <div key={i} style={{fontFamily:"'Space Mono',monospace",fontSize:s==="→"?20:10,color:s==="→"?T.dkGrey:T.white,background:s!=="→"?T.dkGrey:"transparent",padding:s!=="→"?"10px 14px":"0 8px",borderRadius:s!=="→"?2:0,letterSpacing:s!=="→"?1:0,fontWeight:700,marginBottom:8}}>{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── STOCK BASICS ───────────────────────────────────────────────────────── */
function StockBasicsPage({setPage}) {
  const [active, setActive] = useState(0);
  const topics = [
    {icon:"📦",title:"What Is a Stock?",tag:"FOUNDATIONS",type:"text",content:`A stock represents a share of ownership in a company. When you buy a stock, you become a part-owner — called a shareholder — of that business.

If the company grows and becomes more profitable, the value of your shares typically rises. If it struggles or loses money, the value can fall. Companies sell stocks on public exchanges (like the NYSE or NASDAQ) to raise money for expansion, research, debt repayment, and more.

Every publicly traded company has a ticker symbol — a short code like AAPL (Apple), TSLA (Tesla), or NVDA (Nvidia). When you buy that ticker, you're buying a slice of that business.

KEY TERMS:
— Share: One unit of ownership in a company
— Market Cap: Total value of all shares (price × total shares)
— Dividend: A portion of profits paid to shareholders
— IPO (Initial Public Offering): When a company first sells shares to the public`},
    {icon:"📊",title:"Stock Price & Volatility",tag:"PRICE ACTION",type:"text",content:`A stock's price is determined entirely by supply and demand — how many people want to buy versus how many want to sell at any given moment.

Volatility measures how much a stock's price swings over time. A stock with high volatility can gain or lose 5–10% in a single day. A low-volatility stock might barely move over weeks.

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
— High investor confidence and media optimism

BEAR MARKET SIGNS:
— Economic slowdown or recession
— Rising interest rates or inflation concerns
— Mass selling and declining corporate profits`},
    {icon:"🔢",title:"Portfolio & Diversification",tag:"STRATEGY",type:"text",content:`Your portfolio is the full collection of all your investments. Diversification means spreading those investments across different companies, industries, and asset types so that a single bad event doesn't destroy your entire portfolio.

DIVERSIFICATION STRATEGIES:
— By Sector: Tech, healthcare, finance, energy, consumer goods
— By Size: Large-cap, mid-cap, small-cap stocks
— By Geography: US, international, emerging markets
— By Asset Class: Stocks, bonds, ETFs, commodities`},
    {icon:"🗞️",title:"News & Market Impact",tag:"MARKET DYNAMICS",type:"text",content:`The market reacts to news — sometimes rationally, often emotionally.

TYPES OF NEWS THAT MOVE STOCKS:
— Earnings Reports: Quarterly results vs. analyst expectations
— Economic Data: Jobs reports, inflation numbers, GDP figures
— Federal Reserve: Interest rate decisions and policy signals
— Company Events: CEO changes, product launches, acquisitions, scandals
— Geopolitical Events: Wars, trade policy, elections

THE NEWS → PRICE CHAIN:
Positive surprise → More buyers than sellers → Price rises
Negative surprise → More sellers than buyers → Price falls`},
    {icon:"⚖️",title:"Risk Management",tag:"FUNDAMENTALS",type:"text",content:`Every investment carries risk. Risk management is the set of strategies you use to limit how much you can lose.

CORE CONCEPTS:

Position Sizing: No single stock should be more than 5–10% of your portfolio.

Stop-Loss Orders: Set a price at which you automatically sell. Buy at $100, stop-loss at $85 = max 15% loss.

Risk/Reward Ratio: 1:3 ratio means risking $100 to potentially gain $300.

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
    {type:"indicator",icon:"⭐",title:"1–5 Buy/Sell Rating",tag:"AI SCORING",color:T.lime,
      subtitle:"Our AI's Clear Signal System",
      overview:"Stocks Advisor distills complex AI analysis into a single 1–5 rating combining news sentiment, technical signals, volatility, and fundamental outlook.",
      howItWorks:[["News Sentiment","AI reads and scores recent news. Weighted by source credibility and recency."],["Technical Momentum","Based on MACD signal, price trend direction, and volume patterns."],["Volatility Adjustment","Extremely volatile stocks are penalized — higher risk requires higher reward."],["Fundamental Context","Revenue trends, earnings history, sector performance."]],
      signals:[{label:"5 — Strong Buy",desc:"Strong alignment: positive news, solid fundamentals, bullish technicals.",col:"#00FF88"},{label:"4 — Buy",desc:"More positives than negatives. Worth considering.",col:"#88CC00"},{label:"3 — Neutral",desc:"Mixed signals. Hold if you own it, wait if you don't.",col:T.lime},{label:"2 — Sell",desc:"More negatives emerging. Consider reducing position.",col:"#FF8800"},{label:"1 — Strong Sell",desc:"Significant negative momentum. High caution.",col:"#FF4444"}],
      warning:"This rating is AI-generated for educational purposes only — NOT financial advice."
    },
    {type:"indicator",icon:"🔬",title:"Research Capabilities",tag:"AI CAPABILITIES",color:"#A78BFA",
      subtitle:"What Our AI Scans and How",
      overview:"Stocks Advisor's AI research engine is powered by Claude. It reads, understands context, draws connections, and synthesizes information the way an experienced analyst would.",
      howItWorks:[["News Aggregation","Scans dozens of credible financial sources: Reuters, MarketWatch, SEC filings, earnings transcripts."],["Sentiment Analysis","Understands nuance and context in financial writing — not just keyword matching."],["Cross-Stock Correlation","If bad news hits a supplier, the AI connects this to manufacturers that rely on them."],["Plain-English Output","All research translated into clear, jargon-free language."]],
      signals:[{label:"Earnings Analysis",desc:"Reads full earnings releases, compares to estimates, summarizes beat/miss.",col:"#A78BFA"},{label:"Insider Activity",desc:"Tracks SEC Form 4 filings — when executives buy or sell their own stock.",col:T.lime},{label:"Analyst Upgrades",desc:"Summarizes when major banks change ratings and price targets.",col:"#00FF88"},{label:"Macro Context",desc:"Connects Fed decisions, inflation data, and geopolitical events to stock impacts.",col:"#FF8800"}],
      warning:"AI research is a starting point. Always cross-reference important decisions."
    },
  ];

  const topic = topics[active];
  const DIVIDER_IDX = 6;

  return (
    <div style={{padding:"100px 0 80px",maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"270px 1fr",gap:0,minHeight:"80vh"}}>
      <div style={{borderRight:`1px solid ${T.dkGrey}`,position:"sticky",top:88,alignSelf:"start",maxHeight:"calc(100vh - 88px)",overflowY:"auto"}}>
        <div style={{padding:"0 24px 20px",borderBottom:`1px solid ${T.dkGrey}`,marginBottom:8}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.lime,letterSpacing:3,textTransform:"uppercase"}}>STOCK BASICS + GUIDE</div>
        </div>
        {topics.map((t,i)=>{
          const accentCol = t.type==="indicator" ? (t.color||T.lime) : T.lime;
          return (
            <div key={i}>
              {i===DIVIDER_IDX && (<div style={{padding:"14px 24px 8px",borderTop:`1px solid ${T.dkGrey}`,marginTop:8}}><div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,letterSpacing:3,textTransform:"uppercase"}}>── INDICATORS ──</div></div>)}
              <div onClick={()=>setActive(i)} style={{padding:"13px 24px",cursor:"pointer",borderLeft:active===i?`3px solid ${accentCol}`:"3px solid transparent",background:active===i?T.offBlk:"transparent",transition:"all 0.15s"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:active===i?accentCol:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:3}}>{t.tag}</div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:600,color:active===i?T.white:T.grey}}>{t.icon} {t.title}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div key={active} style={{padding:"0 56px 40px",animation:"fadeIn 0.25s ease"}}>
        {topic.type==="text" ? (
          <>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>{topic.tag}</div>
            <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(28px,4vw,52px)",fontWeight:900,lineHeight:1.05,letterSpacing:-1,marginBottom:40,color:T.white}}>{topic.icon} {topic.title}</h1>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,lineHeight:1.85,color:T.grey,whiteSpace:"pre-line"}}>{topic.content}</div>
          </>
        ) : (
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
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:10,marginBottom:36}}>
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

/* ─── NEWS UPDATES — real Finnhub market news ────────────────────────────── */
function NewsPage() {
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState([]);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    (async () => {
      try {
        // Finnhub general market news — category: general gives top financial news
        const data = await finnhub("news", { category: "general", minId: 0 });
        // Map to our display format
        const mapped = (data || []).slice(0, 20).map(a => ({
          headline: a.headline,
          source: a.source,
          summary: a.summary?.slice(0, 200) || "",
          url: a.url,
          image: a.image,
          datetime: a.datetime,
          related: a.related || "",   // ticker if associated
          category: a.category,
        }));
        setArticles(mapped);
      } catch (e) {
        setErr("Failed to load news. Check your Finnhub API key in Vercel environment variables.");
      }
      setLoading(false);
    })();
  }, []);

  const categories = ["All", "general", "forex", "crypto", "merger"];
  const filtered = filter === "All" ? articles : articles.filter(a => a.category === filter);

  function timeAgo(ts) {
    const diff = Math.floor((Date.now() / 1000) - ts);
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div style={{padding:"100px 48px 80px",maxWidth:1100,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:48,flexWrap:"wrap",gap:24}}>
        <div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>LIVE · FINNHUB</div>
          <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(32px,6vw,72px)",fontWeight:900,lineHeight:0.9,letterSpacing:-2}}>NEWS<br/><span style={{color:T.lime}}>UPDATES</span></h1>
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {categories.map(s=>(
            <button key={s} onClick={()=>setFilter(s)} className="nav-btn" style={{background:filter===s?T.lime:"transparent",color:filter===s?T.black:T.grey,border:"none",borderRadius:4,padding:"6px 12px",cursor:"pointer",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:1,fontWeight:700,textTransform:"uppercase",transition:"all 0.15s"}}>{s}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{textAlign:"center",padding:"80px 0"}}><div style={{fontSize:32,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:20}}>⚙️</div><div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:T.grey,letterSpacing:1}}>FETCHING LIVE NEWS FROM FINNHUB…</div></div>}
      {err && <div style={{color:"#FF4444",fontFamily:"'Space Mono',monospace",fontSize:13,padding:"20px",background:"#FF444418",border:"1px solid #FF444444",borderRadius:4}}>{err}</div>}

      {!loading && !err && (
        <div style={{display:"grid",gap:1,border:`1px solid ${T.dkGrey}`}}>
          {filtered.map((a,i)=>(
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"grid",gridTemplateColumns:"90px 1fr",gap:0,borderBottom:`1px solid ${T.dkGrey}`,background:T.black,transition:"background 0.15s",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=T.offBlk} onMouseLeave={e=>e.currentTarget.style.background=T.black}>
              {/* Image / source col */}
              <div style={{borderRight:`1px solid ${T.dkGrey}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,padding:"16px 10px"}}>
                {a.image ? (
                  <img src={a.image} alt="" style={{width:60,height:44,objectFit:"cover",borderRadius:2,opacity:.8}} onError={e=>e.target.style.display="none"}/>
                ) : (
                  <div style={{width:60,height:44,background:T.dkGrey,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:18}}>📰</span></div>
                )}
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textAlign:"center",letterSpacing:.5,lineHeight:1.3}}>{a.source}</div>
              </div>
              {/* Content col */}
              <div style={{padding:"20px 24px"}}>
                <div style={{display:"flex",gap:10,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
                  {a.related && <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,color:T.lime}}>{a.related}</span>}
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:1,textTransform:"uppercase"}}>{a.category}</span>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,marginLeft:"auto"}}>{timeAgo(a.datetime)}</span>
                </div>
                <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,fontWeight:700,color:T.white,marginBottom:6,lineHeight:1.35}}>{a.headline}</div>
                {a.summary && <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:12,color:T.grey,lineHeight:1.6}}>{a.summary.slice(0,180)}{a.summary.length>180?"…":""}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
      {!loading && !err && filtered.length === 0 && (
        <div style={{textAlign:"center",padding:"60px 0",color:T.grey,fontFamily:"'Space Mono',monospace",fontSize:12}}>No articles in this category right now.</div>
      )}
    </div>
  );
}

/* ─── INDICATORS — live Finnhub quote + AI analysis ─────────────────────── */
function IndicatorsPage() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState(null);

  const analyze = useCallback(async () => {
    if (!ticker.trim() || loading) return;
    setLoading(true); setResult(null); setQuote(null); setErr(null);
    const sym = ticker.trim().toUpperCase();
    try {
      // 1. Fetch real quote + company profile from Finnhub in parallel
      const [q, profile, metric] = await Promise.all([
        finnhub("quote", { symbol: sym }),
        finnhub("stock/profile2", { symbol: sym }),
        finnhub("stock/metric", { symbol: sym, metric: "all" }),
      ]);

      setQuote({ q, profile, metric });

      // 2. Build context from real data to feed the AI
      const realContext = `
Real market data for ${sym}:
- Current price: $${fmt(q.c)}
- Change today: ${fmtChg(q.dp)} ($${fmt(q.d)})
- Open: $${fmt(q.o)}, High: $${fmt(q.h)}, Low: $${fmt(q.l)}
- Previous close: $${fmt(q.pc)}
- 52-week high: $${fmt(metric?.metric?.["52WeekHigh"])}, 52-week low: $${fmt(metric?.metric?.["52WeekLow"])}
- Beta: ${metric?.metric?.beta ?? "N/A"}
- Company: ${profile?.name ?? sym}, Sector: ${profile?.finnhubIndustry ?? "Unknown"}
- Market cap: ${profile?.marketCapitalization ? "$" + (profile.marketCapitalization / 1000).toFixed(1) + "B" : "N/A"}
`;

      // 3. AI analysis using real data as grounding
      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          system: `You are a stock technical analysis engine. You are given REAL market data. Use it to produce a grounded analysis. Respond ONLY with valid JSON, no markdown, no backticks:
{
  "ticker": "SYMBOL",
  "companyName": "Full Company Name",
  "macd": {
    "signal": "Bullish Crossover" or "Bearish Crossover" or "Neutral / Consolidating",
    "trend": "Uptrend" or "Downtrend" or "Sideways",
    "histogram": "Expanding" or "Contracting" or "Flat",
    "interpretation": "1-2 sentence plain-English MACD analysis using the real price data provided"
  },
  "volatility": {
    "level": "Low" or "Medium" or "High" or "Extreme",
    "betaNote": "Brief note on the beta value provided",
    "interpretation": "1-2 sentence volatility analysis based on real beta and 52-week range"
  },
  "rating": {
    "score": 4,
    "label": "Buy" or "Strong Buy" or "Neutral" or "Sell" or "Strong Sell",
    "breakdown": { "newsSentiment": 4, "technicalMomentum": 3, "volatilityAdjusted": 4, "fundamentalContext": 4 },
    "rationale": "2-3 sentence rationale grounded in the real data"
  },
  "research": {
    "keyTheme": "One sentence on the dominant story for this stock",
    "recentDevelopment": "Brief note on recent context",
    "analystSentiment": "Bullish" or "Neutral" or "Bearish",
    "sectorOutlook": "1 sentence on sector performance"
  },
  "entryNote": "1-2 sentences on entry/exit based on real price levels",
  "disclaimer": "This is AI-generated analysis using real market data for educational purposes only. Not financial advice."
}`,
          messages: [{ role: "user", content: `Analyze ${sym} using this real data:\n${realContext}` }]
        })
      });
      const d = await res.json();
      const raw = d.content?.find(b => b.type === "text")?.text || "";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setResult(parsed);
    } catch (e) {
      setErr("Analysis failed. Make sure both FINNHUB_API_KEY and ANTHROPIC_API_KEY are set in Vercel.");
    }
    setLoading(false);
  }, [ticker, loading]);

  const rCol = (s) => s==="Strong Buy"||s==="Buy" ? "#00FF88" : s==="Strong Sell"||s==="Sell" ? "#FF4444" : T.lime;
  const vCol = (l) => l==="Low"?"#00FF88":l==="Medium"?T.lime:l==="High"?"#FF8800":"#FF4444";
  const mCol = (s) => s?.includes("Bullish")?"#00FF88":s?.includes("Bearish")?"#FF4444":T.lime;
  const scoreN = (n) => n>=4?"#00FF88":n>=3?T.lime:"#FF4444";

  return (
    <div style={{padding:"100px 48px 80px",maxWidth:1000,margin:"0 auto"}}>
      <div style={{marginBottom:56}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>LIVE · FINNHUB + AI</div>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(32px,6vw,72px)",fontWeight:900,lineHeight:0.9,letterSpacing:-2,marginBottom:16}}>INDICATORS<br/><span style={{color:T.lime}}>DASHBOARD</span></h1>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:15,color:T.grey,maxWidth:520,lineHeight:1.6}}>Real Finnhub market data + AI analysis. Enter any US stock ticker for live price, 52-week range, beta, and a full technical breakdown.</p>
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

      {loading && (
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:32,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:16}}>⚙️</div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:T.grey,letterSpacing:1,marginBottom:20}}>FETCHING LIVE DATA + RUNNING AI ANALYSIS…</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
            {["Live Finnhub quote","52-week range","Beta & metrics","AI analysis"].map((s,i)=>(
              <div key={i} style={{background:T.offBlk,border:`1px solid ${T.dkGrey}`,borderRadius:20,padding:"4px 12px",fontSize:10,color:T.grey,fontFamily:"'Space Mono',monospace"}}>{s}</div>
            ))}
          </div>
        </div>
      )}

      {err && <div style={{color:"#FF4444",fontFamily:"'Space Mono',monospace",fontSize:13,padding:"20px",background:"#FF444418",border:"1px solid #FF444444",borderRadius:4}}>{err}</div>}

      {quote && result && !loading && (
        <div style={{animation:"fadeIn 0.5s ease"}}>
          {/* Live quote bar */}
          <div style={{background:T.offBlk,border:`1px solid ${T.dkGrey}`,borderRadius:2,padding:"20px 28px",marginBottom:2,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
            <div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:28,fontWeight:700,color:T.lime,lineHeight:1}}>{result.ticker}</div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,color:T.grey,marginTop:3}}>{quote.profile?.name || result.companyName} · {quote.profile?.finnhubIndustry || ""}</div>
            </div>
            <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:28,fontWeight:700,color:T.white}}>${fmt(quote.q.c)}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:13,color:(quote.q.dp??0)>=0?"#00FF88":"#FF4444"}}>{fmtChg(quote.q.dp)} ({fmt(quote.q.d)})</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[["Open",`$${fmt(quote.q.o)}`],["High",`$${fmt(quote.q.h)}`],["Low",`$${fmt(quote.q.l)}`],["Prev Close",`$${fmt(quote.q.pc)}`]].map(([k,v])=>(
                  <div key={k} style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,textTransform:"uppercase",letterSpacing:1,width:60}}>{k}</span>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:T.white,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {[
                  ["52W High",`$${fmt(quote.metric?.metric?.["52WeekHigh"])}`],
                  ["52W Low",`$${fmt(quote.metric?.metric?.["52WeekLow"])}`],
                  ["Beta",quote.metric?.metric?.beta?.toFixed(2)??"N/A"],
                  ["Mkt Cap",quote.profile?.marketCapitalization?`$${(quote.profile.marketCapitalization/1000).toFixed(1)}B`:"N/A"],
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

          {/* 4-panel AI analysis grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,border:`1px solid ${T.dkGrey}`,marginBottom:2}}>
            <div style={{padding:"28px",borderRight:`1px solid ${T.dkGrey}`,borderBottom:`1px solid ${T.dkGrey}`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>📉 MACD INDICATOR</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {[{l:"Signal",v:result.macd?.signal,c:mCol(result.macd?.signal)},{l:"Trend",v:result.macd?.trend,c:result.macd?.trend==="Uptrend"?"#00FF88":result.macd?.trend==="Downtrend"?"#FF4444":T.lime},{l:"Histogram",v:result.macd?.histogram,c:T.grey}].map((b,i)=>(
                  <div key={i} style={{background:`${b.c}14`,border:`1px solid ${b.c}44`,borderRadius:3,padding:"6px 10px"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{b.l}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:b.c}}>{b.v}</div>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65}}>{result.macd?.interpretation}</div>
            </div>
            <div style={{padding:"28px",borderBottom:`1px solid ${T.dkGrey}`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>🌊 VOLATILITY</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                {[{l:"Level",v:result.volatility?.level,c:vCol(result.volatility?.level)},{l:"Beta",v:quote.metric?.metric?.beta?.toFixed(2)??"N/A",c:T.white}].map((b,i)=>(
                  <div key={i} style={{background:`${b.c}14`,border:`1px solid ${b.c}44`,borderRadius:3,padding:"6px 10px"}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>{b.l}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:b.c}}>{b.v}</div>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65}}>{result.volatility?.interpretation}</div>
            </div>
            <div style={{padding:"28px",borderRight:`1px solid ${T.dkGrey}`}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>⭐ BUY/SELL RATING</div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:48,fontWeight:700,color:rCol(result.rating?.label),lineHeight:1}}>{result.rating?.score}<span style={{fontSize:20,color:T.grey}}>/5</span></div>
                <div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:13,fontWeight:700,color:rCol(result.rating?.label),marginBottom:6}}>{result.rating?.label}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                    {Object.entries(result.rating?.breakdown||{}).map(([k,v])=>(
                      <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                        <div style={{width:28,height:4,background:T.dkGrey,borderRadius:2,overflow:"hidden"}}><div style={{width:`${(v/5)*100}%`,height:"100%",background:scoreN(v)}}/></div>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textTransform:"uppercase"}}>{k.replace(/([A-Z])/g," $1").trim().slice(0,8)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65}}>{result.rating?.rationale}</div>
            </div>
            <div style={{padding:"28px"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.grey,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>🔬 RESEARCH SUMMARY</div>
              <div style={{display:"flex",gap:8,marginBottom:16}}>
                <div style={{background:`${T.lime}14`,border:`1px solid ${T.lime}44`,borderRadius:3,padding:"6px 10px"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:8,color:T.grey,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Analyst Sentiment</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color:result.research?.analystSentiment==="Bullish"?"#00FF88":result.research?.analystSentiment==="Bearish"?"#FF4444":T.lime}}>{result.research?.analystSentiment}</div>
                </div>
              </div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65,marginBottom:10}}><span style={{color:T.white,fontWeight:600}}>Key theme: </span>{result.research?.keyTheme}</div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.65,marginBottom:10}}><span style={{color:T.white,fontWeight:600}}>Recent: </span>{result.research?.recentDevelopment}</div>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:12,color:T.grey,lineHeight:1.6,fontStyle:"italic"}}>{result.research?.sectorOutlook}</div>
            </div>
          </div>

          <div style={{background:T.offBlk,border:`1px solid ${T.dkGrey}`,borderLeft:`3px solid ${T.lime}`,borderRadius:2,padding:"18px 22px",marginBottom:16}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:T.lime,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>ENTRY / EXIT NOTE</div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,color:T.grey,lineHeight:1.7}}>{result.entryNote}</div>
          </div>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,color:T.grey,textAlign:"center",padding:"12px",border:`1px solid ${T.dkGrey}`,borderRadius:2}}>⚠️ {result.disclaimer}</div>
        </div>
      )}
    </div>
  );
}

/* ─── AI ADVISOR ─────────────────────────────────────────────────────────── */
function AIAdvisorPage() {
  const [messages,setMessages] = useState([
    {role:"assistant",content:"Hey! I'm your Stocks Advisor AI. I can help you with anything stocks — from explaining basic concepts to analyzing specific tickers, discussing trading strategies, or breaking down what recent market news means for your portfolio. What would you like to explore?"}
  ]);
  const [input,setInput] = useState("");
  const [loading,setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const send = useCallback(async()=>{
    const q = input.trim();
    if(!q||loading) return;
    const newMsgs = [...messages,{role:"user",content:q}];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const res = await fetch("/api/claude",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",max_tokens:1000,
          system:`You are the Stocks Advisor AI — a knowledgeable, friendly, and clear financial assistant. You help users with everything stock-related: explaining basic concepts, analyzing specific stocks, discussing trading strategies, explaining market indicators, breaking down news and its market impact, and helping users think through investment decisions. Style: direct, no fluff, plain English, structure responses clearly when helpful. Always add a brief disclaimer when discussing specific investment decisions. You are NOT a licensed financial advisor.`,
          messages:newMsgs.map(m=>({role:m.role,content:m.content}))
        })
      });
      const d = await res.json();
      const reply = d.content?.find(b=>b.type==="text")?.text||"Sorry, I couldn't generate a response. Please try again.";
      setMessages(prev=>[...prev,{role:"assistant",content:reply}]);
    } catch(e){ setMessages(prev=>[...prev,{role:"assistant",content:"Something went wrong. Please try again."}]); }
    setLoading(false);
  },[input,messages,loading]);

  const SUGGESTIONS = ["Analyze NVIDIA for me","What is the MACD indicator?","Explain what a bull market is","How should I diversify my portfolio?","What does a P/E ratio mean?","Is Tesla a good buy right now?"];

  return (
    <div style={{padding:"100px 0 0",maxWidth:900,margin:"0 auto",display:"flex",flexDirection:"column",height:"calc(100vh - 88px)"}}>
      <div style={{padding:"0 32px 24px",borderBottom:`1px solid ${T.dkGrey}`,flexShrink:0}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:T.lime,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>STOCKS ADVISOR</div>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:"clamp(24px,4vw,44px)",fontWeight:900,lineHeight:1,letterSpacing:-1}}>AI ADVISOR <span style={{color:T.lime}}>CHAT</span></h1>
        <p style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,marginTop:6}}>Ask me anything — stock analysis, concepts, strategies, market news.</p>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"24px 32px",display:"flex",flexDirection:"column",gap:20}}>
        {messages.map((m,i)=>{
          const isUser=m.role==="user";
          return (
            <div key={i} style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start",animation:"fadeUp 0.3s ease"}}>
              {!isUser && <div style={{width:28,height:28,background:T.lime,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginRight:12,marginTop:2,alignSelf:"flex-start"}}><span style={{fontSize:12,fontWeight:900,color:T.black}}>AI</span></div>}
              <div style={{maxWidth:"75%",padding:"14px 18px",background:isUser?T.dkGrey:T.offBlk,border:`1px solid ${isUser?T.mdGrey:T.dkGrey}`,borderRadius:isUser?"12px 12px 2px 12px":"2px 12px 12px 12px",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,lineHeight:1.75,color:T.white,whiteSpace:"pre-wrap"}}>{m.content}</div>
              {isUser && <div style={{width:28,height:28,background:T.dkGrey,border:`1px solid ${T.mdGrey}`,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:12,marginTop:2,alignSelf:"flex-start"}}><span style={{fontSize:12,color:T.grey}}>U</span></div>}
            </div>
          );
        })}
        {loading && (
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,background:T.lime,borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:12,fontWeight:900,color:T.black}}>AI</span></div>
            <div style={{background:T.offBlk,border:`1px solid ${T.dkGrey}`,borderRadius:"2px 12px 12px 12px",padding:"14px 18px",display:"flex",gap:6,alignItems:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,background:T.lime,borderRadius:"50%",animation:"blink 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      {messages.length<=1 && (
        <div style={{padding:"0 32px 16px",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
          {SUGGESTIONS.map(s=>(
            <button key={s} onClick={()=>setInput(s)} style={{background:"transparent",border:`1px solid ${T.dkGrey}`,color:T.grey,borderRadius:20,padding:"6px 14px",fontSize:11,fontFamily:"'Space Mono',monospace",cursor:"pointer",transition:"all 0.15s",letterSpacing:.5}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.lime;e.currentTarget.style.color=T.lime;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.dkGrey;e.currentTarget.style.color=T.grey;}}>{s}</button>
          ))}
        </div>
      )}
      <div style={{padding:"16px 32px 24px",borderTop:`1px solid ${T.dkGrey}`,flexShrink:0,display:"flex",gap:12,alignItems:"flex-end"}}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask about any stock, concept, or strategy… (Enter to send)" rows={2}
          style={{flex:1,background:T.offBlk,border:`1px solid ${T.dkGrey}`,color:T.white,borderRadius:4,padding:"12px 16px",fontSize:14,fontFamily:"'Space Grotesk',sans-serif",resize:"none",outline:"none",lineHeight:1.5,transition:"border-color 0.15s"}}
          onFocus={e=>e.target.style.borderColor=T.lime} onBlur={e=>e.target.style.borderColor=T.dkGrey}
        />
        <button onClick={send} disabled={loading||!input.trim()} className="lime-btn" style={{background:loading||!input.trim()?T.dkGrey:T.lime,color:loading||!input.trim()?T.grey:T.black,border:"none",borderRadius:4,padding:"12px 22px",fontWeight:700,fontSize:12,fontFamily:"'Space Mono',monospace",cursor:loading||!input.trim()?"default":"pointer",letterSpacing:1,textTransform:"uppercase",transition:"all 0.15s",flexShrink:0}}>{loading?"…":"SEND"}</button>
      </div>
    </div>
  );
}

/* ─── FOOTER ─────────────────────────────────────────────────────────────── */
function Footer({setPage}) {
  return (
    <footer style={{borderTop:`1px solid ${T.dkGrey}`,padding:"48px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,alignItems:"start"}}>
      <div>
        <div style={{fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:16,marginBottom:6}}><span style={{color:T.white}}>STOCKS </span><span style={{color:T.lime}}>ADVISOR</span></div>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,color:T.grey,lineHeight:1.7,maxWidth:280}}>AI-powered stock intelligence. For educational purposes only. Not financial advice. Always do your own research.</div>
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

/* ─── APP ROOT ───────────────────────────────────────────────────────────── */
export default function App() {
  const [page,setPage] = useState("Home");
  const changePage = (p)=>{ setPage(p); window.scrollTo(0,0); };
  return (
    <div style={{background:T.black,color:T.white,minHeight:"100vh",fontFamily:"'Space Grotesk',sans-serif"}}>
      <style>{GLOBAL_CSS}</style>
      <Nav page={page} setPage={changePage}/>
      <Ticker/>
      <div style={{paddingTop:88}}>
        {page==="Home"          && <HomePage      setPage={changePage}/>}
        {page==="How It Works"  && <HowItWorksPage/>}
        {page==="Stock Basics"  && <StockBasicsPage setPage={changePage}/>}
        {page==="News Updates"  && <NewsPage/>}
        {page==="Indicators"    && <IndicatorsPage/>}
        {page==="AI Advisor"    && <AIAdvisorPage/>}
        {page!=="AI Advisor"    && <Footer setPage={changePage}/>}
      </div>
    </div>
  );
}
