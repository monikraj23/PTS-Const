import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

interface Entry {
  entry_date: string;
  category: string;
  rate: number;
  normal_hours: number;
  overtime_hours: number;
  num_workers: number;
  site_id: string;
  supervisor_email?: string;
  overtime_multiplier?: number; // added for cost calc
}

interface DailyReport {
  date: string;
  totalWorkers: number;
  totalCost: number;
  entries: Entry[];
  categories: { name: string; workers: number; cost: number }[];
}

const ReportsSection = () => {
  const { toast } = useToast();
  const [reportData, setReportData] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [siteId, setSiteId] = useState("all");
  const [startDate, setStartDate] = useState("2025-06-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("daily_entries")
        .select("*")
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);

      if (siteId !== "all") {
        query = query.eq("site_id", siteId);
      }

      const { data, error } = await query;

      if (error) {
        toast({
          title: "Error fetching data",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const grouped = groupEntriesByDate(data || []);
      setReportData(grouped);

      toast({
        title: "Report Loaded",
        description: `${grouped.length} day(s) of data loaded`,
      });
    } catch {
      toast({
        title: "Unexpected Error",
        description: "Something went wrong while fetching data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateTotalCost = (
    rate: number,
    normalHours: number,
    overtimeHours: number,
    multiplier: number = 1.5,
    workers: number
  ) => {
    const normalCost = rate * normalHours * workers;
    const otCost = rate * overtimeHours * multiplier * workers;
    return normalCost + otCost;
  };

  const groupEntriesByDate = (entries: Entry[]): DailyReport[] => {
    const grouped: Record<string, DailyReport> = {};

    for (const entry of entries) {
      const dateOnly = entry.entry_date.split("T")[0] || entry.entry_date.split(" ")[0];
      const multiplier = entry.overtime_multiplier || 1.5;

      const totalCost = calculateTotalCost(
        entry.rate,
        entry.normal_hours,
        entry.overtime_hours,
        multiplier,
        entry.num_workers
      );

      if (!grouped[dateOnly]) {
        grouped[dateOnly] = {
          date: dateOnly,
          totalWorkers: 0,
          totalCost: 0,
          categories: [],
          entries: [],
        };
      }

      grouped[dateOnly].totalWorkers += entry.num_workers;
      grouped[dateOnly].totalCost += totalCost;
      grouped[dateOnly].entries.push(entry);

      const existing = grouped[dateOnly].categories.find((c) => c.name === entry.category);
      if (existing) {
        existing.workers += entry.num_workers;
        existing.cost += totalCost;
      } else {
        grouped[dateOnly].categories.push({
          name: entry.category,
          workers: entry.num_workers,
          cost: totalCost,
        });
      }
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  };

  const downloadExcel = () => {
    const rows: any[] = [];

    reportData.forEach((report) => {
      report.entries.forEach((entry) => {
        const multiplier = entry.overtime_multiplier || 1.5;
        const totalCost = calculateTotalCost(
          entry.rate,
          entry.normal_hours,
          entry.overtime_hours,
          multiplier,
          entry.num_workers
        );

        rows.push({
          Date: report.date,
          Site: entry.site_id,
          Category: entry.category,
          Workers: entry.num_workers,
          Cost: Math.round(totalCost),
          Supervisor: entry.supervisor_email || "Unknown",
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    XLSX.writeFile(workbook, "Site_Report.xlsx");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Site Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {Array.from({ length: 10 }).map((_, i) => (
                  <SelectItem key={`site${i + 1}`} value={`site${i + 1}`}>
                    Site {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={fetchData} disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Display */}
      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="animate-spin h-5 w-5" />
              Loading Report...
            </CardTitle>
          </CardHeader>
        </Card>
      ) : reportData.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <CardTitle>Daily Site Report</CardTitle>
            <Button variant="outline" onClick={downloadExcel}>
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {reportData.map((report) => (
              <div key={report.date} className="border p-4 rounded space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">{report.date}</p>
                    <p className="text-lg font-semibold">
                      Workers: {report.totalWorkers}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Total Cost</p>
                    <p className="text-xl font-bold text-orange-700">
                      ₹{report.totalCost.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {report.entries.map((entry, idx) => {
                    const multiplier = entry.overtime_multiplier || 1.5;
                    const totalCost = calculateTotalCost(
                      entry.rate,
                      entry.normal_hours,
                      entry.overtime_hours,
                      multiplier,
                      entry.num_workers
                    );

                    return (
                      <div key={idx} className="bg-gray-100 p-3 rounded">
                        <p className="text-sm font-medium">{entry.category}</p>
                        <p className="text-sm">Workers: {entry.num_workers}</p>
                        <p className="text-sm">Cost: ₹{Math.round(totalCost)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Site: {entry.site_id}
                        </p>
                        <p className="text-xs text-gray-500">
                          Uploaded by: {entry.supervisor_email || "Unknown"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Report Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No data for selected site/date. Try changing filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportsSection;