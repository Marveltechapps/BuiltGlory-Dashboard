import type { CSSProperties } from 'react';
import {
  Activity, AlertCircle, AlertTriangle, Ban, BarChart2, Bell, Building, Building2, Calendar, CalendarClock, CalendarOff, Check, CheckCircle,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Copy, CreditCard, Download, ExternalLink, Eye, EyeOff, FileSpreadsheet, FileText,
  FilterX, HelpCircle, Image, Inbox, LayoutDashboard, LayoutGrid, List, Loader2, LogOut, Mail, MapPin, Menu, MessageCircle, MessageSquare,
  MoreHorizontal, Pause, Pencil, Phone, PhoneOff, Play, Plus, RefreshCw, Search, SearchX, Send, Settings, Shield, ShieldCheck, Star, Trash2,
  TrendingUp, Unlock, Upload, User, UserPlus, UserRound, Users, Video, Wrench, X, XCircle, Handshake,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  activity: Activity, 'alert-circle': AlertCircle, 'alert-triangle': AlertTriangle, ban: Ban, 'bar-chart-2': BarChart2, bell: Bell,
  building: Building, 'building-2': Building2, calendar: Calendar, 'calendar-clock': CalendarClock, 'calendar-off': CalendarOff, check: Check,
  'check-circle': CheckCircle, 'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'chevron-up': ChevronUp,
  clock: Clock, copy: Copy, 'credit-card': CreditCard, download: Download, 'external-link': ExternalLink, eye: Eye, 'eye-off': EyeOff,
  'file-spreadsheet': FileSpreadsheet, 'file-text': FileText, 'filter-x': FilterX, handshake: Handshake, 'help-circle': HelpCircle, image: Image,
  inbox: Inbox, 'layout-dashboard': LayoutDashboard, 'layout-grid': LayoutGrid, list: List, 'loader-2': Loader2, 'log-out': LogOut, mail: Mail,
  'map-pin': MapPin, menu: Menu, 'message-circle': MessageCircle, 'message-square': MessageSquare, 'more-horizontal': MoreHorizontal,
  pause: Pause, pencil: Pencil, phone: Phone, 'phone-off': PhoneOff, play: Play, plus: Plus, 'refresh-cw': RefreshCw, search: Search,
  'search-x': SearchX, send: Send, settings: Settings, shield: Shield, 'shield-check': ShieldCheck, star: Star, 'trash-2': Trash2,
  'trending-up': TrendingUp, unlock: Unlock, upload: Upload, user: User, 'user-plus': UserPlus, 'user-round': UserRound, users: Users,
  video: Video, wrench: Wrench, x: X, 'x-circle': XCircle,
};

export type IconName = keyof typeof ICONS | (string & {});

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  spin?: boolean;
  style?: CSSProperties;
  className?: string;
}

/** Lucide icon by kebab-case name (same names the reference design uses). */
export function Icon({ name, size = 16, stroke = 2, spin, style, className }: IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return (
    <Cmp
      width={size}
      height={size}
      strokeWidth={stroke}
      aria-hidden="true"
      className={className}
      style={{ display: 'block', flexShrink: 0, animation: spin ? 'bg-spin 1s linear infinite' : undefined, ...style }}
    />
  );
}
