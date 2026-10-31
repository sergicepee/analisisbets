import { useId } from "react";

// Punto único de iconos: cambia aquí cualquier icono sin tocar la lógica de datos.
export {
  Search as IconSearch, User as IconUser, CalendarDays as IconCalendar, Mail as IconMail,
  ChevronLeft as IconPrev, ChevronRight as IconNext, ChevronRight as IconGo, ArrowLeft as IconBack,
  Goal as IconNet, Flag as IconCorner, Target as IconTarget, Footprints as IconShoe,
  ArrowLeftRight as IconSwap, LayoutGrid as IconMatches, Trophy as IconTrophy, LineChart as IconStats,
  Info as IconInfo, TrendingUp as IconMax, TrendingDown as IconMin, Circle as IconBall, Square as IconCard,
  BarChart3 as IconBars, Settings as IconSettings, Camera as IconCamera, Pencil as IconEdit, LockKeyhole as IconLock, Send as IconSend, HelpCircle as IconHelp,
  Handshake as IconHandshake, LogOut as IconLogOut, Eye as IconEye, EyeOff as IconEyeOff, Globe as IconGlobe,
  Moon as IconMoon, Sun as IconSun, Monitor as IconMonitor, X as IconClose,
} from "lucide-react";

export function IconSoccerBall({ size = 16, ownGoal = false }: { size?: number; ownGoal?: boolean }) {
  const clipPathId = `soccer-ball-${useId().replace(/:/g, "")}`;
  const markColor = ownGoal ? "#E5484D" : "#111111";

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="inline-block shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      <defs>
        <clipPath id={clipPathId}>
          <circle cx="12" cy="12" r="10.6" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="10.6" fill="#FFFFFF" />
      <g clipPath={`url(#${clipPathId})`} fill={markColor} stroke={markColor} strokeWidth="0.9" strokeLinejoin="round">
        <polygon points="12,8 15.8,10.76 14.35,15.24 9.65,15.24 8.2,10.76" />
        <polygon points="12,5.3 8.48,2.74 9.83,-1.39 14.17,-1.39 15.52,2.74" />
        <polygon points="18.37,9.93 19.72,5.79 24.07,5.79 25.41,9.93 21.89,12.49" />
        <polygon points="15.94,17.42 20.29,17.42 21.63,21.56 18.11,24.11 14.59,21.56" />
        <polygon points="8.06,17.42 9.41,21.56 5.89,24.11 2.37,21.56 3.71,17.42" />
        <polygon points="5.63,9.93 2.11,12.49 -1.41,9.93 -0.07,5.79 4.28,5.79" />
        <line x1="12" y1="8" x2="12" y2="5.3" />
        <line x1="15.804226065180615" y1="10.76393202250021" x2="18.37207865917753" y2="9.929586137687853" />
        <line x1="14.351141009169893" y1="15.23606797749979" x2="15.938161190359569" y2="17.42041386231215" />
        <line x1="9.648858990830108" y1="15.23606797749979" x2="8.061838809640431" y2="17.42041386231215" />
        <line x1="8.195773934819385" y1="10.763932022500208" x2="5.627921340822471" y2="9.92958613768785" />
        <line x1="15.518909110292068" y1="2.743362879187305" x2="19.716182335987444" y2="5.792860379313241" />
        <line x1="21.890987769469596" y1="12.486223258500548" x2="20.28777205732387" y2="17.42041386231215" />
        <line x1="14.594057513549654" y1="21.557139620686762" x2="9.40594248645035" y2="21.55713962068676" />
        <line x1="3.712227942676129" y1="17.42041386231215" x2="2.109012230530405" y2="12.486223258500544" />
        <line x1="4.283817664012553" y1="5.792860379313238" x2="8.48109088970793" y2="2.7433628791873064" />
      </g>
      <circle cx="12" cy="12" r="10.6" fill="none" stroke={markColor} strokeWidth="1.1" />
    </svg>
  );
}

export function IconSubstitution({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="inline-block shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      <circle cx="12" cy="12" r="11" fill="#E5484D" stroke="#F8F8F8" strokeWidth="1.5" />
      <path d="M16.5 12H8m3.5-4L7.5 12l4 4" fill="none" stroke="#F8F8F8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSubstitutionIn({ size = 13 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="inline-block shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      <circle cx="12" cy="12" r="11" fill="#B8E3B8" stroke="#F8F8F8" strokeWidth="1.5" />
      <path d="M7.5 12H16m-3.5-4 4 4-4 4" fill="none" stroke="#17331F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAssist({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="inline-block shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      <circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#111111" strokeWidth="1.1" />
      <path d="M4.6 13.9c0-1.1.7-1.8 1.8-2l3.2-.6 1.5-3.1c.3-.6 1-.9 1.6-.7l1.9.6-.2 1.9c2.6.4 5.2 1.5 6.1 2.8.5.7.3 2.4-.8 2.4H5.8c-.7 0-1.2-.5-1.2-1.3z" fill="#111111" />
      <path d="M9.4 11.3l1.2 1.2M11.2 9.9l1.3 1.1" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M6.6 15.4v1.6M10.1 15.4v1.6M13.6 15.4v1.6M17.1 15.4v1.6" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlayerCard({ size = 13, red = false }: { size?: number; red?: boolean }) {
  const color = red ? "#E5484D" : "#F5C842";

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 12 16" className="inline-block shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
      <rect x="1" y="1" width="10" height="14" rx="1" fill={color} stroke="#F8F8F8" strokeWidth="1" />
    </svg>
  );
}
