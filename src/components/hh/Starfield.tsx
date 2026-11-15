import { useLayoutEffect, useRef, useState } from "react";

export function Starfield({ className = "" }: { className?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const align = () => {
      const rect = frame.current?.getBoundingClientRect();
      if (rect) setOffset({ left: -rect.left, top: -rect.top });
    };
    align();
    window.addEventListener("resize", align);
    return () => window.removeEventListener("resize", align);
  }, []);
  return (
    <div ref={frame} className={`home-starlight ${className}`} aria-hidden="true">
    <svg style={{ position: "absolute", left: offset.left, top: offset.top, width: "100vw", height: "100svh", maxWidth: "none" }} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
            {Array.from({ length: 52 }, (_, index) => {
              const x = (index * 233 + 71) % 1440;
              const y = (index * 137 + 43) % 900;
              return <circle key={index} className="home-star" cx={x} cy={y} r={index % 7 === 0 ? 2 : 0.8 + (index % 3) * 0.35} style={{ animationDelay: `${-(index % 11)}s`, animationDuration: `${5 + index % 5}s` }} />;
            })}
            {([[190, 250], [1205, 215], [1100, 655], [290, 710]] as const).map(([x, y], index) => <g key={index} className="home-star home-star-cross" style={{ animationDelay: `${-index * 2}s`, animationDuration: `${7 + index}s` }}><path d={`M${x} ${y - 7}Q${x} ${y} ${x + 7} ${y}Q${x} ${y} ${x} ${y + 7}Q${x} ${y} ${x - 7} ${y}Q${x} ${y} ${x} ${y - 7}Z`} /></g>)}
          </svg>
    </div>
  );
}
