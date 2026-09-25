import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { friendlyError, isValidEmail, isValidNigerianPhone } from "@/lib/members";

export const Route = createFileRoute("/admin/members/import")({
  head: () => ({
    meta: [
      { title: "Import members — CoopOS Nigeria" },
      {
        name: "description",
        content: "Upload a spreadsheet of members, review each row, then import the valid ones.",
      },
      { property: "og:title", content: "Import members — CoopOS Nigeria" },
      {
        property: "og:description",
        content: "Upload a spreadsheet of members, review each row, then import the valid ones.",
      },
    ],
  }),
  component: ImportMembersPage,
});

const COLUMNS = [
  "member_number",
  "first_name",
  "last_name",
  "middle_name",
  "gender",
  "date_of_birth",
  "phone",
  "email",
  "employer",
  "staff_number",
  "department",
  "join_date",
];

function get(values: Record<string, string>, key: string): string {
  return values[key] ?? "";
}

type Row = { values: Record<string, string>; errors: string[] };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function ImportMembersPage() {
  const { cooperative } = useSession();
  const coopId = cooperative?.id ?? null;
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; failed: number } | null>(null);

  function downloadTemplate() {
    const blob = new Blob([`${COLUMNS.join(",")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "member-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setSummary(null);
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      toast.error("That file has a header row but no member rows.");
      setRows([]);
      return;
    }
    const header = (parsed[0] ?? []).map((h) => h.trim().toLowerCase());
    const body = parsed.slice(1);
    const next: Row[] = body.map((cells) => {
      const values: Record<string, string> = {};
      header.forEach((h, i) => {
        values[h] = (cells[i] ?? "").trim();
      });
      const errors: string[] = [];
      if (!get(values, "first_name")) errors.push("First name is required");
      if (!get(values, "last_name")) errors.push("Last name is required");
      if (get(values, "email") && !isValidEmail(get(values, "email")))
        errors.push("Email looks wrong");
      if (get(values, "phone") && !isValidNigerianPhone(get(values, "phone")))
        errors.push("Phone looks wrong");
      if (get(values, "join_date") && Number.isNaN(Date.parse(get(values, "join_date"))))
        errors.push("Join date is not a valid date");
      return { values, errors };
    });
    setRows(next);
  }

  async function runImport() {
    if (!coopId) return;
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast.error("There are no valid rows to import.");
      return;
    }
    setImporting(true);
    let imported = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        let memberNumber = get(row.values, "member_number");
        if (!memberNumber) {
          const { data, error } = await supabase.rpc("next_member_number", {
            _cooperative_id: coopId,
          });
          if (error) throw error;
          memberNumber = data as string;
        }
        const { error } = await supabase.from("members").insert({
          cooperative_id: coopId,
          member_number: memberNumber,
          membership_number: memberNumber,
          first_name: get(row.values, "first_name"),
          last_name: get(row.values, "last_name"),
          middle_name: get(row.values, "middle_name") || null,
          gender: get(row.values, "gender") || null,
          date_of_birth: get(row.values, "date_of_birth") || null,
          phone: get(row.values, "phone") || null,
          email: get(row.values, "email") || null,
          employer: get(row.values, "employer") || null,
          staff_number: get(row.values, "staff_number") || null,
          join_date: get(row.values, "join_date") || new Date().toISOString().slice(0, 10),
          lifecycle_status: "PENDING_VERIFICATION",
          status: "PENDING",
        });
        if (error) throw error;
        imported += 1;
      } catch (error) {
        failed += 1;
        row.errors.push(friendlyError(error));
      }
    }
    setRows([...rows]);
    setSummary({ imported, failed });
    setImporting(false);
    void queryClient.invalidateQueries({ queryKey: ["member-directory"] });
    toast.success(`${imported} member${imported === 1 ? "" : "s"} imported.`);
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;

  return (
    <>
      <PageHeader
        title="Import members"
        description="Upload a CSV file, check the preview, then import the rows that pass validation."
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            Download template
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose your file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="block text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {fileName && <p className="text-sm text-muted-foreground">Loaded {fileName}</p>}
          <p className="text-xs text-muted-foreground">
            Imported members arrive as pending verification, so nothing becomes active without a
            review. Excel files can be saved as CSV before uploading.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">
              2. Preview — {validCount} of {rows.length} rows are ready
            </CardTitle>
            <Button onClick={runImport} disabled={importing || validCount === 0}>
              {importing ? "Importing…" : `Import ${validCount} rows`}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary && (
              <p className="text-sm">
                {summary.imported} imported, {summary.failed} could not be saved.
              </p>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs text-muted-foreground">{index + 2}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {get(row.values, "member_number") || "auto"}
                      </TableCell>
                      <TableCell>
                        {get(row.values, "first_name")} {get(row.values, "last_name")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {get(row.values, "email") || get(row.values, "phone") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.errors.length === 0 ? (
                          <span className="text-muted-foreground">Ready</span>
                        ) : (
                          <span className="text-destructive">{row.errors.join("; ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
