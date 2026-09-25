import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Coins,
  CreditCard,
  Gauge,
  Landmark,
  LifeBuoy,
  LineChart,
  PiggyBank,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  UserCircle,
  Wallet,
  Bell,
  FileText,
  Home,
  Layers,
  FileUp,
  ShieldAlert,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Permission required to see the item. Undefined = visible to the whole area. */
  permission?: string;
  /** True when the destination is an architectural placeholder. */
  placeholder?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const memberNav: NavGroup[] = [
  {
    label: "My cooperative",
    items: [
      { label: "Home", to: "/portal", icon: Home },
      { label: "Savings", to: "/portal/savings", icon: PiggyBank },
      { label: "Salary deductions", to: "/portal/checkoff", icon: CalendarClock },
      { label: "Loans", to: "/portal/loans", icon: Landmark },
      { label: "Shares", to: "/portal/shares", icon: Coins, placeholder: true },
      { label: "Withdrawals", to: "/portal/withdrawals", icon: Wallet },
      { label: "Statements", to: "/portal/statements", icon: FileText, placeholder: true },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Notifications", to: "/portal/notifications", icon: Bell },
      { label: "Profile", to: "/portal/profile", icon: UserCircle },
    ],
  },
];

export const adminNav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", icon: Gauge },
      { label: "Alerts", to: "/admin/alerts", icon: Bell },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Members", to: "/admin/members", icon: Users, permission: "members.view" },
      { label: "Member dashboard", to: "/admin/members/dashboard", icon: BarChart3, permission: "members.view" },

      { label: "Check-off", to: "/admin/checkoff", icon: CalendarClock, permission: "checkoff.view" },
      { label: "Upload payroll file", to: "/admin/checkoff/import", icon: FileUp, permission: "checkoff.view" },
      { label: "Check-off exceptions", to: "/admin/checkoff/exceptions", icon: ShieldAlert, permission: "checkoff.view" },
      { label: "Check-off reports", to: "/admin/checkoff/reports", icon: BarChart3, permission: "checkoff.view" },
      { label: "Employers & payroll", to: "/admin/checkoff/profiles", icon: Building2, permission: "checkoff.view" },
      { label: "Loans", to: "/admin/loans", icon: Landmark, permission: "loans.view" },
      { label: "Loan applications", to: "/admin/loans/applications", icon: ClipboardList, permission: "loans.view" },
      { label: "Loan book", to: "/admin/loans/book", icon: BookOpenCheck, permission: "loans.view" },
      { label: "Loan products", to: "/admin/loans/products", icon: Layers, permission: "loans.view" },
      { label: "Loan settings", to: "/admin/loans/settings", icon: Settings, permission: "loans.view" },
      { label: "Loan reports", to: "/admin/loans/reports", icon: BarChart3, permission: "loans.view" },
      { label: "Collections", to: "/admin/repayments", icon: Gauge, permission: "repayments.view" },
      { label: "Repayments", to: "/admin/repayments/payments", icon: Receipt, permission: "repayments.view" },
      { label: "Unapplied money", to: "/admin/repayments/exceptions", icon: ShieldAlert, permission: "repayments.view" },
      { label: "Delinquency", to: "/admin/repayments/delinquency", icon: LineChart, permission: "repayments.view" },
      { label: "Collection cases", to: "/admin/repayments/cases", icon: ClipboardList, permission: "collections.view" },
      { label: "Waivers & settlements", to: "/admin/repayments/workflows", icon: ScrollText, permission: "repayments.view" },
      { label: "Repayment reports", to: "/admin/repayments/reports", icon: BarChart3, permission: "repayments.view" },
      { label: "Repayment settings", to: "/admin/repayments/settings", icon: Settings, permission: "repayments.view" },
      { label: "Withdrawals", to: "/admin/withdrawals", icon: Wallet, permission: "withdrawals.view" },
      { label: "Withdrawal queue", to: "/admin/withdrawals/pending", icon: ClipboardList, permission: "withdrawals.view" },
      { label: "Withdrawal issues", to: "/admin/withdrawals/exceptions", icon: ShieldAlert, permission: "withdrawals.view" },
      { label: "Withdrawal types", to: "/admin/withdrawals/types", icon: Layers, permission: "withdrawals.view" },
      { label: "Exit settlements", to: "/admin/withdrawals/exit-settlements", icon: ScrollText, permission: "withdrawals.view" },
      { label: "Withdrawal reports", to: "/admin/withdrawals/reports", icon: BarChart3, permission: "withdrawals.view" },

    ],
  },
  {
    label: "Savings",
    items: [
      { label: "Savings dashboard", to: "/admin/savings", icon: PiggyBank, permission: "savings.view" },
      { label: "Savings accounts", to: "/admin/savings/accounts", icon: Wallet, permission: "savings.view" },
      { label: "Contributions", to: "/admin/savings/contributions", icon: Coins, permission: "savings.view" },
      { label: "Contribution schedules", to: "/admin/savings/schedules", icon: CalendarClock, permission: "savings.view" },
      { label: "Savings transactions", to: "/admin/savings/transactions", icon: ScrollText, permission: "savings.view" },
      { label: "Savings products", to: "/admin/savings/products", icon: Layers, permission: "savings.view" },
      { label: "Opening balances", to: "/admin/savings/opening-balances", icon: FileText, permission: "savings.view" },
      { label: "Savings bonus", to: "/admin/savings/bonus", icon: Coins, permission: "savings.view" },
      { label: "Savings reports", to: "/admin/savings/reports", icon: BarChart3, permission: "savings.view" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Accounting", to: "/admin/accounting", icon: BookOpenCheck, permission: "accounting.view" },
      { label: "General ledger", to: "/admin/accounting/general-ledger", icon: BookOpenCheck, permission: "accounting.view" },
      { label: "Banking", to: "/admin/banking", icon: CreditCard, permission: "banking.view", placeholder: true },
      { label: "Treasury", to: "/admin/treasury", icon: CircleDollarSign, permission: "treasury.view", placeholder: true },
      { label: "Reports", to: "/admin/reports", icon: BarChart3, permission: "reports.view", placeholder: true },
    ],
  },
  {
    label: "Control",
    items: [
      { label: "Governance", to: "/admin/governance", icon: ClipboardList, permission: "governance.view", placeholder: true },
      { label: "Approvals", to: "/admin/approvals", icon: ShieldCheck },
      { label: "Rules", to: "/admin/rules", icon: Settings, permission: "settings.view" },
      { label: "Users & roles", to: "/admin/administration", icon: Users, permission: "administration.users" },
      { label: "Audit trail", to: "/admin/audit", icon: ScrollText, permission: "administration.audit" },
    ],
  },
];

export const platformNav: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { label: "Dashboard", to: "/platform", icon: Gauge },
      { label: "Cooperatives", to: "/platform/cooperatives", icon: Building2 },
      { label: "Users", to: "/platform/users", icon: Users },
      { label: "Audit", to: "/platform/audit", icon: ScrollText },
    ],
  },
  {
    label: "Commercial",
    items: [
      { label: "Subscriptions", to: "/platform/subscriptions", icon: Banknote, placeholder: true },
      { label: "Usage", to: "/platform/usage", icon: LineChart, placeholder: true },
      { label: "Support", to: "/platform/support", icon: LifeBuoy, placeholder: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Configuration", to: "/platform/configuration", icon: Layers },
      { label: "Security", to: "/platform/security", icon: Shield },
    ],
  },
];
