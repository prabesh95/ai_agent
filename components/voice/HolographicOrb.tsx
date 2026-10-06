import { useId } from "react";
export type OrbState = "ready" | "listening" | "transcribing" | "thinking" | "speaking";
const descriptions: Record<OrbState, [string, string]> = {
  ready: ["Ready when you are", "Start with a thought, a question, or your voice."],
  listening: ["I’m listening", "Speak naturally. I’ll take it from here."],
  transcribing: ["Finding your words", "Turning your voice into a message."],
  thinking: ["Connecting the dots", "Your reply is taking shape."],
  speaking: ["A thought, out loud", "You can stop playback at any time."],
};
export function HolographicOrb({ state }: { state: OrbState }) {
  const id = useId().replace(/:/g, "");
  return <section className={`orb-stage orb-state-${state}`} aria-label="Assistant visualization">
    <div className="orb-stage-heading"><span className="eyebrow">PERSONAL INTELLIGENCE</span><span className="orb-state-label"><span className="status-dot" />{state === "thinking" ? "Generating" : state}</span></div>
    <div className="orb-scene" aria-hidden="true">
      <div className="orb-haze" /><div className="orb-orbit orbit-one" /><div className="orb-orbit orbit-two" /><div className="orb-orbit orbit-three" />
      <div className="orb-sphere">
        <svg viewBox="0 0 320 320" className="orb-wireframe">
          <defs><radialGradient id={`${id}-glow`}><stop offset="0" stopColor="#b6f6ff" stopOpacity=".65" /><stop offset=".18" stopColor="#23bcff" stopOpacity=".32" /><stop offset="1" stopColor="#0864b8" stopOpacity=".02" /></radialGradient></defs>
          <circle cx="160" cy="160" r="146" fill={`url(#${id}-glow)`} />
          <g fill="none" stroke="currentColor"><circle cx="160" cy="160" r="146" /><circle cx="160" cy="160" r="130" strokeDasharray="2 7" />
            <ellipse cx="160" cy="160" rx="146" ry="48" /><ellipse cx="160" cy="160" rx="146" ry="94" />
            <ellipse cx="160" cy="160" rx="48" ry="146" /><ellipse cx="160" cy="160" rx="94" ry="146" />
            <ellipse cx="160" cy="160" rx="70" ry="146" transform="rotate(48 160 160)" />
            <ellipse cx="160" cy="160" rx="70" ry="146" transform="rotate(-48 160 160)" /></g>
          <g className="orb-points" fill="currentColor"><circle cx="45" cy="106" r="2.5" /><circle cx="224" cy="29" r="2" /><circle cx="273" cy="237" r="3" /><circle cx="95" cy="290" r="2" /><circle cx="156" cy="15" r="2" /></g>
        </svg>
        <div className="orb-core"><span /><span /><span /></div>
        <div className="orb-equator" />
      </div>
      <div className="orb-platform"><span /><span /><span /></div>
      <span className="orb-coordinate coordinate-left">VOICE / TEXT</span><span className="orb-coordinate coordinate-right">01 · INTERFACE</span>
    </div>
    <div className="orb-copy"><h2>{descriptions[state][0]}</h2><p>{descriptions[state][1]}</p>
      <div className="waveform" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((bar) => <span key={bar} />)}</div>
    </div>
  </section>;
}
