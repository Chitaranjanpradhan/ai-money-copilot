"use client";

/**
 * AG Grid (hackathon sponsor) — sortable/filterable table view of live
 * PayPal invoice data, themed to match the app's design tokens.
 */
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  backgroundColor: "#1a1a19",
  foregroundColor: "#f0efec",
  headerBackgroundColor: "#222220",
  headerTextColor: "#c3c2b7",
  borderColor: "rgba(255,255,255,0.1)",
  accentColor: "#3987e5",
  oddRowBackgroundColor: "#1d1d1c",
  fontFamily: "inherit",
  fontSize: 13,
  rowHoverColor: "rgba(57,135,229,0.08)",
});

export interface GridInvoice {
  id: string;
  status: string;
  invoiceNumber?: string;
  recipientName?: string;
  recipientEmail?: string;
  amount?: { currency_code: string; value: string };
  dueDate?: string;
  daysOverdue: number;
  recipientViewUrl?: string;
}

const STATUS_COLOR: Record<string, string> = {
  PAID: "var(--good)",
  MARKED_AS_PAID: "var(--good)",
  SENT: "var(--warning)",
  UNPAID: "var(--warning)",
  PAYMENT_PENDING: "var(--warning)",
  PARTIALLY_PAID: "var(--serious)",
  CANCELLED: "var(--critical)",
};

const columnDefs: ColDef<GridInvoice>[] = [
  {
    headerName: "Customer",
    valueGetter: (p) => p.data?.recipientName || p.data?.recipientEmail || p.data?.id,
    flex: 2,
    minWidth: 150,
  },
  { headerName: "Invoice #", field: "invoiceNumber", flex: 1, minWidth: 100 },
  {
    headerName: "Amount",
    valueGetter: (p) => Number(p.data?.amount?.value ?? 0),
    valueFormatter: (p) => `$${Number(p.value).toFixed(2)}`,
    type: "rightAligned",
    flex: 1,
    minWidth: 110,
    cellStyle: { fontVariantNumeric: "tabular-nums" },
  },
  { headerName: "Due date", field: "dueDate", flex: 1, minWidth: 110 },
  {
    headerName: "Days late",
    field: "daysOverdue",
    flex: 1,
    minWidth: 100,
    type: "rightAligned",
    cellStyle: (p) => ({
      color: (p.value ?? 0) > 0 ? "var(--critical)" : "var(--ink-muted)",
      fontVariantNumeric: "tabular-nums",
    }),
  },
  {
    headerName: "Status",
    field: "status",
    flex: 1,
    minWidth: 130,
    cellRenderer: (p: ICellRendererParams<GridInvoice>) => (
      <span style={{ color: STATUS_COLOR[p.value] ?? "var(--ink-2)", fontWeight: 500 }}>
        {String(p.value ?? "").replaceAll("_", " ")}
      </span>
    ),
  },
  {
    headerName: "",
    colId: "pay",
    sortable: false,
    filter: false,
    width: 80,
    cellRenderer: (p: ICellRendererParams<GridInvoice>) =>
      p.data?.recipientViewUrl ? (
        <a
          href={p.data.recipientViewUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)", fontSize: 12 }}
        >
          pay ↗
        </a>
      ) : null,
  },
];

export default function InvoiceGrid({ invoices }: { invoices: GridInvoice[] }) {
  return (
    <div style={{ height: 420, width: "100%" }}>
      <AgGridReact<GridInvoice>
        theme={theme}
        rowData={invoices}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, filter: true, resizable: true }}
        animateRows
        suppressCellFocus
      />
    </div>
  );
}
