import type {Material} from './production';

export type HudSymbol = 'coins'|'population'|'happiness'|'storage'|'level'|Material;

/** Original, small-format illustrations. Labels live on the surrounding control. */
export function HudIcon({name,className=''}:{name:HudSymbol;className?:string}) {
  return <svg className={`hud-symbol ${className}`} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    {name==='coins'&&<>
      <ellipse cx="18" cy="35" rx="14" ry="7" fill="#b8750b"/>
      <path d="M4 29v6c0 9 28 9 28 0v-6" fill="#ecaa19" stroke="#b8750b" strokeWidth="1.5"/>
      <ellipse cx="18" cy="29" rx="14" ry="7" fill="#ffe491" stroke="#cb8c11" strokeWidth="1.5"/>
      <circle cx="29" cy="20" r="16" fill="#e9a719" stroke="#b8750b" strokeWidth="2"/>
      <circle cx="29" cy="19" r="12" fill="#ffdb62" stroke="#fff1ae" strokeWidth="2"/>
      <path d="M33 13c-8-4-12 5-4 6s4 10-4 6m4-15v18" stroke="#a86705" strokeWidth="2.7" strokeLinecap="round"/>
      <path d="M19 10l3-2" stroke="#fff8da" strokeWidth="3" strokeLinecap="round"/>
    </>}
    {name==='population'&&<>
      <circle cx="33" cy="14" r="7" fill="#52c7f3" stroke="#1683be" strokeWidth="1.5"/>
      <path d="M23 40V29c0-12 21-12 21 0v11" fill="#2e9cd5" stroke="#1472ae" strokeWidth="2"/>
      <circle cx="17" cy="12" r="8" fill="#8bdfff" stroke="#1683be" strokeWidth="1.5"/>
      <path d="M4 41V29c0-13 26-13 26 0v12H4Z" fill="#38b6ed" stroke="#137ab5" strokeWidth="2"/>
      <path d="M9 29v8m12-8v8M12 8l3-2" stroke="#c3f1ff" strokeWidth="2.5" strokeLinecap="round"/>
    </>}
    {name==='happiness'&&<>
      <circle cx="24" cy="25" r="19" fill="#73bd30"/>
      <circle cx="24" cy="22" r="18" fill="#b2e85a" stroke="#66a829" strokeWidth="1.5"/>
      <path d="M12 12c3-4 7-5 11-5" stroke="#e5ffb0" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="17" cy="20" rx="2" ry="3" fill="#376923"/><ellipse cx="31" cy="20" rx="2" ry="3" fill="#376923"/>
      <path d="M15 28c5 7 13 7 18 0" stroke="#376923" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="12" cy="26" r="2.5" fill="#8fcf42"/><circle cx="36" cy="26" r="2.5" fill="#8fcf42"/>
    </>}
    {name==='storage'&&<>
      <path d="M6 18L24 6l18 12v25H6V18Z" fill="#a28ce9" stroke="#6953b1" strokeWidth="2"/>
      <path d="M3 19L24 4l21 15" stroke="#d8cafa" strokeWidth="5" strokeLinejoin="round"/>
      <path d="M13 23h22v20H13z" fill="#6552a6"/><path d="M16 28h16m-16 5h16m-16 5h16" stroke="#bca7f1" strokeWidth="2"/>
      <rect x="20" y="14" width="8" height="5" rx="1" fill="#e8e3ff"/>
    </>}
    {name==='level'&&<>
      <path d="M14 29L9 44l12-5 5 6 7-17" fill="#a48ce9" stroke="#6147aa" strokeWidth="1.5"/>
      <path d="M24 3l6 4 7 1 2 7 4 6-4 6-2 7-7 2-6 4-6-4-7-2-2-7-4-6 4-6 2-7 7-1 6-4Z" fill="#8c67cf" stroke="#dac6ff" strokeWidth="2"/>
      <path d="M24 11l3.2 6.5 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1 3.2-6.5Z" fill="#ffe3a3" stroke="#efc36c"/>
    </>}
    {name==='wood'&&<>
      <path d="M9 31L29 9c10-4 18 9 10 16L19 43" fill="#97613c" stroke="#65432b" strokeWidth="2"/>
      <path d="M16 27L34 10m-9 23l17-16" stroke="#c58b53" strokeWidth="2"/>
      <ellipse cx="13" cy="35" rx="9" ry="10" transform="rotate(-35 13 35)" fill="#e8bd7b" stroke="#724a2d" strokeWidth="2"/>
      <ellipse cx="13" cy="35" rx="4" ry="5" transform="rotate(-35 13 35)" stroke="#b07b43" strokeWidth="2"/>
    </>}
    {name==='metal'&&<>
      <path d="M4 30l9-15 24-4 7 17-10 10-30-8Z" fill="#8eaec3" stroke="#526e85" strokeWidth="2"/>
      <path d="M4 30l29-5 11 3-10 10L4 30Z" fill="#637f95"/><path d="M13 15l20 10 4-14" fill="#c7dfe9"/>
      <path d="M16 17l15 6" stroke="#effbff" strokeWidth="2"/>
    </>}
    {name==='stone'&&<>
      <path d="M5 34l6-18 14-9 15 11 4 20-24 4L5 34Z" fill="#98a6b5" stroke="#627386" strokeWidth="2"/>
      <path d="M11 16l14-9 5 18-10 17-4-18-5-8Z" fill="#c4cdd5"/><path d="M30 25l10-7 4 20-24 4" fill="#7d8d9e"/>
    </>}
    {name==='planks'&&<>
      <path d="M5 24L34 8l10 6-29 17L5 24Zm0 10l29-16 10 6-29 17-10-7Z" fill="#edb86f" stroke="#986237" strokeWidth="2"/>
      <path d="M15 31v4l29-17v-4M15 41v4l29-17v-4" fill="#ae773e"/>
      <path d="M13 24l22-12M13 34l22-12" stroke="#ffd89b" strokeWidth="2"/>
    </>}
    {name==='nails'&&<>
      <path d="M15 13l6 1-7 28-2 3-1-4 4-28Zm17-2l5 4-20 25-4 2 1-4 18-27Z" fill="#9bb8ca" stroke="#536c80" strokeWidth="1.5"/>
      <ellipse cx="18" cy="12" rx="8" ry="3" fill="#d4e4ed" stroke="#536c80" strokeWidth="1.5"/>
      <path d="M29 8l12 9" stroke="#536c80" strokeWidth="5" strokeLinecap="round"/><path d="M29 7l12 9" stroke="#d4e4ed" strokeWidth="3" strokeLinecap="round"/>
    </>}
    {name==='bricks'&&<>
      <path d="M4 27l27-12 13 7v13L17 46 4 39V27Z" fill="#ba5d45" stroke="#8a4636" strokeWidth="2"/>
      <path d="M4 27l27-12 13 7-27 12-13-7Z" fill="#ef9872"/><path d="M17 34v12m11-17v12" stroke="#8a4636" strokeWidth="2"/>
      <path d="M8 16L32 5l10 6v10L18 32 8 26V16Z" fill="#c96e50" stroke="#8a4636" strokeWidth="2"/>
      <path d="M8 16L32 5l10 6-24 11-10-6Z" fill="#ffb48a"/><path d="M18 22v10m12-16v10" stroke="#8a4636" strokeWidth="2"/>
    </>}
  </svg>;
}
