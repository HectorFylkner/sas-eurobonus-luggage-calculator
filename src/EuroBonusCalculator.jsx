import { useState, useEffect, useRef } from 'react';

// ─── Algorithm (unchanged) ─────────────────────────────────────────────────────
const FUEL_PRICE = 9.0;
const LP_PER_SEK = 5;
const ZONE1_KG = 5;
const BETA_ZONE1 = 0.75;
const BETA_ZONE2 = 1.00;
const HANDLING_LP = 100;

const FARE_CONFIG = {
  go:       { bags: 1, kgPerBag: 23, baselineKg: 23 },
  plus:     { bags: 1, kgPerBag: 23, baselineKg: 23 },
  business: { bags: 1, kgPerBag: 32, baselineKg: 32 },
};

const ROUTES = [
  { from: 'STK', to: 'CPH', fromCity: 'Stockholm',  toCity: 'Copenhagen', km: 525,  alpha: 3.85e-5, aircraft: 'A320neo' },
  { from: 'STK', to: 'BCN', fromCity: 'Stockholm',  toCity: 'Barcelona',  km: 2498, alpha: 3.85e-5, aircraft: 'A320neo' },
  { from: 'CPH', to: 'JFK', fromCity: 'Copenhagen', toCity: 'New York',   km: 6198, alpha: 2.74e-5, aircraft: 'A330-300' },
  { from: 'CPH', to: 'NRT', fromCity: 'Copenhagen', toCity: 'Tokyo',      km: 8574, alpha: 2.40e-5, aircraft: 'A350-900' },
];

function calculate(routeIndex, fareClass, checkedWeightKg) {
  const route = ROUTES[routeIndex];
  const fare = FARE_CONFIG[fareClass];
  const totalChecked = checkedWeightKg;
  const weightSaved = Math.max(fare.baselineKg - totalChecked, 0);
  const zone1 = Math.min(weightSaved, ZONE1_KG);
  const zone2 = Math.max(weightSaved - ZONE1_KG, 0);
  const effectiveWeight = BETA_ZONE1 * zone1 + BETA_ZONE2 * zone2;
  const fuelSavedKg = route.alpha * route.km * effectiveWeight;
  const savingsSek = fuelSavedKg * FUEL_PRICE;
  const lpFuel = Math.floor(savingsSek * LP_PER_SEK);
  let bagsSaved;
  if (totalChecked === 0) bagsSaved = fare.bags;
  else if (fare.bags === 2 && totalChecked <= fare.kgPerBag) bagsSaved = 1;
  else bagsSaved = 0;
  const lpHandling = bagsSaved * HANDLING_LP;
  return {
    weightSaved, zone1, zone2, effectiveWeight,
    fuelSavedKg, savingsSek, lpFuel, bagsSaved, lpHandling,
    lpTotal: lpFuel + lpHandling,
    pctSilver: ((lpFuel + lpHandling) / 20000 * 100),
    route, fare,
  };
}

const FLIGHTS = [
  { id: 0, flight: 'SK1423', date: 'Mar 18', routeIndex: 2, fareClass: 'plus' },
  { id: 1, flight: 'SK0417', date: 'Apr 2',  routeIndex: 1, fareClass: 'go' },
  { id: 2, flight: 'SK1102', date: 'Apr 14', routeIndex: 3, fareClass: 'business' },
];

// ─── Animated value ────────────────────────────────────────────────────────────
function useAnimatedValue(target, duration = 400) {
  const [display, setDisplay] = useState(target);
  const ref = useRef(null);
  const startVal = useRef(target);
  const startTime = useRef(null);
  useEffect(() => {
    if (ref.current) cancelAnimationFrame(ref.current);
    startVal.current = display;
    startTime.current = performance.now();
    function tick(now) {
      const p = Math.min((now - startTime.current) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(startVal.current + (target - startVal.current) * e);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target]);
  return display;
}

// ─── Arc Gauge ────────────────────────────────────────────────────────────────
function ArcGauge({ value, maxValue, isMax }) {
  const anim = useAnimatedValue(value, 500);
  const pct = maxValue > 0 ? Math.min(anim / maxValue, 1) : 0;

  const W = 260, H = 150;
  const cx = W / 2, cy = H - 10;
  const r = 105, sw = 10;

  // Draw full half-circle path once, animate fill via stroke-dashoffset
  // This avoids the large-arc-flag flip glitch at 50%
  const pt = (a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [x0, y0] = pt(Math.PI);
  const [x1, y1] = pt(0);
  const arcPath = `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  const arcLen = Math.PI * r; // half-circle circumference
  const dashOffset = arcLen * (1 - pct);

  // Endpoint position for the dot indicator
  const aF = Math.PI * (1 - Math.min(pct, 0.995));
  const [xF, yF] = pt(aF);

  const strokeId = isMax ? 'arcGMax' : 'arcG';

  return (
    <div style={{ position: 'relative', width: W, height: H + 14, margin: '0 auto' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="arcG" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1E6CB6" />
            <stop offset="100%" stopColor="#4DA3E8" />
          </linearGradient>
          <linearGradient id="arcGMax" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1B7A4A" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          <filter id="arcGlow">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          {/* Fade mask — smoothly hides glow at top so it doesn't clash with suitcase */}
          <linearGradient id="glowFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" />
            <stop offset="35%" stopColor="white" />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
          <mask id="glowMask">
            <rect x="0" y="0" width={W} height={H} fill="url(#glowFade)" />
          </mask>
        </defs>

        {/* Background arc */}
        <path d={arcPath} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} strokeLinecap="round" />

        {/* Glow layer — masked to fade out at top, preventing contrast with suitcase */}
        {pct > 0.003 && (
          <g mask="url(#glowMask)">
            <path d={arcPath} fill="none" stroke={`url(#${strokeId})`}
              strokeWidth={sw + 10} strokeLinecap="round"
              strokeDasharray={arcLen} strokeDashoffset={dashOffset}
              filter="url(#arcGlow)" opacity={isMax ? 0.25 : 0.2}
            />
          </g>
        )}

        {/* Fill arc — uses dashoffset to fill progressively */}
        {pct > 0.003 && (
          <path d={arcPath} fill="none" stroke={`url(#${strokeId})`}
            strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={arcLen} strokeDashoffset={dashOffset}
          />
        )}

        {/* Endpoint dot */}
        {pct > 0.01 && pct < 0.99 && <circle cx={xF} cy={yF} r={3.5} fill="white" opacity={0.85} />}
      </svg>

      <div style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 46, fontWeight: 800,
          color: isMax ? '#34D399' : 'white',
          letterSpacing: '-0.04em', lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.4s ease',
        }}>
          {Math.round(anim)}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          color: isMax ? 'rgba(52,211,153,0.4)' : 'rgba(148,163,184,0.3)',
          marginTop: 3, transition: 'color 0.4s ease',
        }}>
          LEVEL POINTS
        </div>
      </div>
    </div>
  );
}

// ─── Premium Luggage ───────────────────────────────────────────────────────────
function Luggage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', height: 190, marginTop: -8 }}>
      <svg width="150" height="190" viewBox="0 0 130 200">
        <defs>
          {/* Body — left-lit 3D surface */}
          <linearGradient id="lBody" x1="0" y1="0.15" x2="1" y2="0.85">
            <stop offset="0%" stopColor="#3F6080" />
            <stop offset="20%" stopColor="#304D6A" />
            <stop offset="55%" stopColor="#213B55" />
            <stop offset="100%" stopColor="#162C42" />
          </linearGradient>
          {/* Right side darkening */}
          <linearGradient id="lDark" x1="0" y1="0" x2="1" y2="0">
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
          </linearGradient>
          {/* Left edge catch light */}
          <linearGradient id="lEdge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="12%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Top bevel */}
          <linearGradient id="lBevel" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="25%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Metal hardware */}
          <linearGradient id="lMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7A94AB" />
            <stop offset="40%" stopColor="#566F84" />
            <stop offset="100%" stopColor="#3A5268" />
          </linearGradient>
          {/* Handle tube — cylindrical */}
          <linearGradient id="lHandle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#36495E" />
            <stop offset="30%" stopColor="#5A7890" />
            <stop offset="50%" stopColor="#627F96" />
            <stop offset="70%" stopColor="#5A7890" />
            <stop offset="100%" stopColor="#36495E" />
          </linearGradient>
          {/* Accent stripe */}
          <linearGradient id="lAccent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1E6CB6" />
            <stop offset="50%" stopColor="#3A8CD4" />
            <stop offset="100%" stopColor="#4DA3E8" />
          </linearGradient>
          {/* Wheel gradient */}
          <radialGradient id="lWheel" cx="0.4" cy="0.4" r="0.6">
            <stop offset="0%" stopColor="#1A2A3A" />
            <stop offset="100%" stopColor="#0C1520" />
          </radialGradient>
        </defs>

        {/* === Telescoping handle === */}
        <rect x="48" y="8" width="5" height="38" rx="1.5" fill="url(#lHandle)" />
        <rect x="48" y="8" width="2.5" height="38" rx="1" fill="rgba(255,255,255,0.04)" />
        <rect x="77" y="8" width="5" height="38" rx="1.5" fill="url(#lHandle)" />
        <rect x="77" y="8" width="2.5" height="38" rx="1" fill="rgba(255,255,255,0.04)" />
        {/* Handle joint rings */}
        <rect x="47" y="42" width="7" height="3" rx="1" fill="url(#lMetal)" opacity="0.6" />
        <rect x="76" y="42" width="7" height="3" rx="1" fill="url(#lMetal)" opacity="0.6" />
        {/* Handle grip — rubber texture */}
        <rect x="45" y="0" width="40" height="11" rx="4" fill="url(#lMetal)" />
        <rect x="45" y="0" width="40" height="11" rx="4" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <rect x="45" y="0" width="40" height="5.5" rx="4" fill="rgba(255,255,255,0.05)" />
        {/* Grip indentations */}
        {[52, 57, 62, 67, 72, 77].map(x => (
          <line key={x} x1={x} y1="2" x2={x} y2="9" stroke="rgba(0,0,0,0.06)" strokeWidth="0.6" />
        ))}

        {/* === Main body === */}
        <rect x="12" y="46" width="106" height="128" rx="11" fill="url(#lBody)" />
        <rect x="12" y="46" width="106" height="128" rx="11" fill="url(#lDark)" />
        {/* Shell border */}
        <rect x="12" y="46" width="106" height="128" rx="11" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
        {/* Left catch light */}
        <rect x="12" y="46" width="38" height="128" rx="11" fill="url(#lEdge)" />
        {/* Top bevel */}
        <rect x="12" y="46" width="106" height="38" rx="11" fill="url(#lBevel)" />

        {/* Shell ribbing — hardshell grooves */}
        {[68, 86, 104, 122, 140, 158].map(y => (
          <g key={y}>
            <line x1="18" y1={y} x2="112" y2={y} stroke="rgba(0,0,0,0.04)" strokeWidth="0.6" />
            <line x1="18" y1={y + 1} x2="112" y2={y + 1} stroke="rgba(255,255,255,0.015)" strokeWidth="0.4" />
          </g>
        ))}

        {/* Zipper track — center seam */}
        <line x1="65" y1="52" x2="65" y2="168" stroke="rgba(0,0,0,0.07)" strokeWidth="1.2" />
        <line x1="65.8" y1="52" x2="65.8" y2="168" stroke="rgba(255,255,255,0.025)" strokeWidth="0.4" />
        {/* Zipper teeth hints */}
        {Array.from({ length: 20 }, (_, i) => 56 + i * 5.6).map(y => (
          <rect key={y} x="63.5" y={y} width="3" height="1.2" rx="0.4" fill="rgba(255,255,255,0.018)" />
        ))}

        {/* === Accent stripe === */}
        <rect x="14" y="104" width="102" height="2.5" rx="1" fill="url(#lAccent)" opacity="0.3" />
        <rect x="14" y="106.5" width="102" height="0.8" rx="0.4" fill="rgba(0,0,0,0.1)" />
        <rect x="14" y="103.2" width="102" height="0.5" rx="0.25" fill="rgba(255,255,255,0.03)" />

        {/* === Carry handle (top, recessed) === */}
        <path d="M 49 54 Q 49 48 54 48 L 76 48 Q 81 48 81 54" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 49 53 Q 49 48 54 48 L 76 48 Q 81 48 81 53" fill="none" stroke="url(#lMetal)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <path d="M 49 52 Q 49 48 54 48 L 76 48 Q 81 48 81 52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeLinecap="round" />

        {/* === TSA lock === */}
        <rect x="57" y="95" width="16" height="11" rx="3" fill="rgba(0,0,0,0.1)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <rect x="57" y="95" width="16" height="5" rx="3" fill="rgba(255,255,255,0.02)" />
        <circle cx="65" cy="100.5" r="1.8" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <circle cx="65" cy="100.5" r="0.6" fill="rgba(255,255,255,0.15)" />
        <rect x="64" y="101.5" width="2" height="2.5" rx="0.5" fill="rgba(255,255,255,0.06)" />

        {/* === Side handle (right) === */}
        <path d="M 119 97 Q 122 97 122 100 L 122 112 Q 122 115 119 115" fill="none" stroke="url(#lMetal)" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
        <path d="M 119 98 Q 121 98 121 100 L 121 112 Q 121 114 119 114" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.6" />

        {/* === Corner protectors === */}
        <path d="M 15 59 L 15 52 Q 15 48 19 48 L 27 48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round" />
        <path d="M 115 59 L 115 52 Q 115 48 111 48 L 103 48" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" strokeLinecap="round" />
        <path d="M 15 163 L 15 169 Q 15 174 20 174 L 27 174" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round" />
        <path d="M 115 163 L 115 169 Q 115 174 110 174 L 103 174" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2" strokeLinecap="round" />

        {/* === Bottom feet === */}
        <circle cx="25" cy="174.5" r="1.5" fill="rgba(255,255,255,0.06)" />
        <circle cx="105" cy="174.5" r="1.5" fill="rgba(255,255,255,0.05)" />

        {/* === Luggage tag === */}
        <rect x="19" y="128" width="28" height="18" rx="3" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <text x="33" y="140" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="rgba(255,255,255,0.2)" letterSpacing="0.1em" fontFamily="Inter, sans-serif">SAS</text>
        <line x1="22" y1="143" x2="44" y2="143" stroke="rgba(255,255,255,0.04)" strokeWidth="0.4" />
        <circle cx="23" cy="130" r="1.8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <line x1="21" y1="128" x2="23" y2="130" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />

        {/* === Spinner wheels === */}
        {/* Left wheel */}
        <rect x="22" y="174" width="16" height="5" rx="2.5" fill="#111D2C" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <ellipse cx="30" cy="182" rx="6.5" ry="5.5" fill="url(#lWheel)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        <ellipse cx="30" cy="182" rx="3.5" ry="2.8" fill="rgba(255,255,255,0.03)" />
        <circle cx="30" cy="182" r="1" fill="rgba(255,255,255,0.08)" />
        {/* Right wheel */}
        <rect x="92" y="174" width="16" height="5" rx="2.5" fill="#111D2C" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        <ellipse cx="100" cy="182" rx="6.5" ry="5.5" fill="url(#lWheel)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        <ellipse cx="100" cy="182" rx="3.5" ry="2.8" fill="rgba(255,255,255,0.03)" />
        <circle cx="100" cy="182" r="1" fill="rgba(255,255,255,0.08)" />

      </svg>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function EuroBonusCalculator() {
  const [selectedFlight, setSelectedFlight] = useState(0);
  const [checkedWeight, setCheckedWeight] = useState(15);

  const flight = FLIGHTS[selectedFlight];
  const route = ROUTES[flight.routeIndex];
  const fare = FARE_CONFIG[flight.fareClass];
  const result = calculate(flight.routeIndex, flight.fareClass, checkedWeight);
  const maxResult = calculate(flight.routeIndex, flight.fareClass, 0);
  const gaugeMax = maxResult.lpTotal || 1;

  const handleFlightSelect = (idx) => {
    setSelectedFlight(idx);
    setCheckedWeight(Math.round(FARE_CONFIG[FLIGHTS[idx].fareClass].baselineKg * 0.5));
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#070B14',
      padding: 24,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Phone */}
      <div style={{
        width: 390, borderRadius: 44, backgroundColor: '#111',
        padding: 10,
        boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
        <div style={{
          borderRadius: 36, overflow: 'hidden', backgroundColor: '#0B111E',
          height: 780, display: 'flex', flexDirection: 'column',
        }}>
          {/* Status bar */}
          <div style={{
            padding: '10px 24px 0', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', fontSize: 13, fontWeight: 600,
            color: 'rgba(255,255,255,0.5)', flexShrink: 0,
          }}>
            <span>9:41</span>
            <div style={{ width: 100, height: 28, backgroundColor: '#000', borderRadius: 14 }} />
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <svg width="16" height="12" viewBox="0 0 16 12">
                <rect x="0" y="8" width="3" height="4" rx="0.5" fill="rgba(255,255,255,0.5)" />
                <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="rgba(255,255,255,0.5)" />
                <rect x="9" y="2" width="3" height="10" rx="0.5" fill="rgba(255,255,255,0.5)" />
                <rect x="13" y="0" width="3" height="12" rx="0.5" fill="rgba(255,255,255,0.25)" />
              </svg>
              <div style={{ width: 22, height: 11, border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 3, position: 'relative' }}>
                <div style={{ position: 'absolute', right: -4, top: 2.5, width: 2, height: 5, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: '0 1px 1px 0' }} />
                <div style={{ width: '65%', height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1.5 }} />
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px 40px' }} className="scrollbar-hide">

            {/* Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 19,
                background: 'linear-gradient(135deg, #1E293B, #334155)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: 'rgba(148,163,184,0.5)',
              }}>EL</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
                  Erik Lindstr&ouml;m
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(148,163,184,0.35)' }}>
                  Silver Member
                </span>
              </div>
            </div>

            {/* Flight selector — clean, no boxes */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.1em', marginBottom: 14 }}>
                UPCOMING FLIGHTS
              </div>

              {FLIGHTS.map((f, i) => {
                const r = ROUTES[f.routeIndex];
                const sel = selectedFlight === i;
                return (
                  <button key={f.id} onClick={() => handleFlightSelect(i)} style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    padding: '14px 0',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: i < FLIGHTS.length - 1 ? '1px solid rgba(148,163,184,0.04)' : 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}>
                    {/* Selection indicator */}
                    <div style={{
                      width: 6, height: 6, borderRadius: 3, marginRight: 14, flexShrink: 0,
                      background: sel ? '#4DA3E8' : 'rgba(148,163,184,0.08)',
                      boxShadow: sel ? '0 0 8px rgba(77,163,232,0.35)' : 'none',
                      transition: 'all 0.3s ease',
                    }} />

                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
                        color: sel ? 'white' : 'rgba(148,163,184,0.3)',
                        transition: 'color 0.2s',
                      }}>
                        {r.from} — {r.to}
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 400,
                        color: sel ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.18)',
                        marginTop: 2, transition: 'color 0.2s',
                      }}>
                        {f.flight} · {f.date} · {r.km.toLocaleString()} km
                      </div>
                    </div>

                    {/* Subtle arrow */}
                    {sel && (
                      <svg width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.3, flexShrink: 0 }}>
                        <path d="M6 4l4 4-4 4" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Luggage */}
            <Luggage />

            {/* Gauge — pulled up to blend with suitcase */}
            <div style={{ marginTop: -24 }}>
              <ArcGauge value={result.lpTotal} maxValue={gaugeMax} isMax={checkedWeight === 0} />
            </div>

            {/* Carry-on celebration */}
            <div style={{
              overflow: 'hidden',
              maxHeight: checkedWeight === 0 ? 52 : 0,
              opacity: checkedWeight === 0 ? 1 : 0,
              transition: 'max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease',
              marginTop: checkedWeight === 0 ? 6 : 0,
            }}>
              <div style={{
                textAlign: 'center',
                padding: '10px 0',
              }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.12)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="rgba(52,211,153,0.5)" strokeWidth="1" />
                    <path d="M4.5 7L6.5 9L9.5 5" stroke="#34D399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#34D399', letterSpacing: '-0.01em' }}>
                    Maximum rewards — carry-on only
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 20,
              marginTop: checkedWeight === 0 ? 4 : 10, marginBottom: 28,
              transition: 'margin 0.3s ease',
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: checkedWeight === 0 ? 'rgba(52,211,153,0.55)' : 'rgba(77,163,232,0.55)', transition: 'color 0.4s' }}>
                {result.lpFuel} fuel
              </span>
              <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.12)' }}>·</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: checkedWeight === 0 ? 'rgba(52,211,153,0.55)' : 'rgba(148,163,184,0.4)', transition: 'color 0.4s' }}>
                {result.lpHandling} handling
              </span>
              {result.fuelSavedKg > 0.01 && <>
                <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.12)' }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(46,139,87,0.5)' }}>
                  {result.fuelSavedKg.toFixed(1)} kg saved
                </span>
              </>}
            </div>

            {/* Slider */}
            <div style={{ padding: '0 4px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.25)', letterSpacing: '0.08em' }}>
                  CHECKED WEIGHT
                </span>
                <div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}>
                    {checkedWeight}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(148,163,184,0.2)', marginLeft: 2 }}>
                    kg
                  </span>
                </div>
              </div>

              <div style={{ position: 'relative', paddingTop: 4 }}>
                <div style={{ position: 'relative', height: 4, borderRadius: 2 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.04)' }} />
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${(checkedWeight / fare.baselineKg) * 100}%`,
                    borderRadius: 2,
                    background: checkedWeight === 0 ? '#34D399' : 'linear-gradient(90deg, #1E6CB6, #4DA3E8)',
                    boxShadow: `0 0 10px ${checkedWeight === 0 ? 'rgba(52,211,153,0.25)' : 'rgba(30,108,182,0.15)'}`,
                    transition: 'background 0.2s',
                  }} />
                </div>
                <input type="range" min={0} max={fare.baselineKg} step={1}
                  value={checkedWeight}
                  onChange={(e) => setCheckedWeight(Number(e.target.value))}
                  style={{ position: 'absolute', top: -8, left: 0, width: '100%', zIndex: 5 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'rgba(148,163,184,0.15)' }}>
                <span>0</span>
                <span>{fare.baselineKg} kg</span>
              </div>

            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
