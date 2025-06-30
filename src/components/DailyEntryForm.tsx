"use client";

import { useState, useEffect } from "react";
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
import { Plus, Minus, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface WorkerCategory {
  id: string;
  name: string;
  short_code: string;
  hourly_rate: number;
  overtime_multiplier: number;
  is_active: boolean;
}

interface WorkerEntry {
  id: string;
  category: string;
  normalHours: number;
  overtimeHours: number;
  workerCount: number;
  rate: number;
  totalCost: number;
}

const siteOptions = Array.from({ length: 10 }, (_, i) => ({
  id: `site${i + 1}`,
  name: `Site ${i + 1}`,
}));

const DailyEntryForm = () => {
  const { toast } = useToast();

  const [workerCategories, setWorkerCategories] = useState<WorkerCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [siteId, setSiteId] = useState("");
  const [entries, setEntries] = useState<WorkerEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState({
    category: "",
    normalHours: 8,
    overtimeHours: 0,
    workerCount: 1,
  });

  // Fetch worker categories
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("worker_categories")
        .select("*")
        .eq("is_active", true);

      if (error) {
        toast({
          title: "Error fetching categories",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setWorkerCategories(data);
      }
    };

    fetchCategories();
  }, []);

  const calculateCost = (
    normalHours: number,
    overtimeHours: number,
    workerCount: number,
    hourlyRate: number,
    overtimeMultiplier: number
  ) => {
    const normalCost = normalHours * hourlyRate;
    const overtimeCost = overtimeHours * hourlyRate * overtimeMultiplier;
    return (normalCost + overtimeCost) * workerCount;
  };

  const addEntry = () => {
    if (!currentEntry.category) {
      toast({
        title: "Category required",
        description: "Please select a worker category.",
        variant: "destructive",
      });
      return;
    }

    const selected = workerCategories.find((cat) => cat.id === currentEntry.category);
    if (!selected) return;

    const cost = calculateCost(
      currentEntry.normalHours,
      currentEntry.overtimeHours,
      currentEntry.workerCount,
      selected.hourly_rate,
      selected.overtime_multiplier
    );

    const newEntry: WorkerEntry = {
      id: Date.now().toString(),
      category: `${selected.name} (${selected.short_code})`,
      normalHours: currentEntry.normalHours,
      overtimeHours: currentEntry.overtimeHours,
      workerCount: currentEntry.workerCount,
      rate: selected.hourly_rate,
      totalCost: cost,
    };

    setEntries([...entries, newEntry]);
    setCurrentEntry({ category: "", normalHours: 8, overtimeHours: 0, workerCount: 1 });

    toast({
      title: "Entry added",
      description: `${selected.name} workers added.`,
    });
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
  };

  const saveDaily = async () => {
    if (!siteId) {
      toast({
        title: "Site not selected",
        description: "Please select a site.",
        variant: "destructive",
      });
      return;
    }

    if (entries.length === 0) {
      toast({
        title: "No entries",
        description: "Add at least one entry before saving.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      toast({
        title: "User not authenticated",
        description: "Please log in to submit entries.",
        variant: "destructive",
      });
      return;
    }

    const formattedRows = entries.map((entry) => ({
      entry_date: selectedDate,
      site_id: siteId,
      supervisor_id: user.id,
      supervisor_email: user.email,
      category: entry.category,
      rate: entry.rate,
      normal_hours: entry.normalHours,
      overtime_hours: entry.overtimeHours,
      num_workers: entry.workerCount,
      total_cost: entry.totalCost,
    }));

    const { error } = await supabase.from("daily_entries").insert(formattedRows);

    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Entries saved",
        description: `${formattedRows.length} entries saved for ${selectedDate}`,
      });
      setEntries([]);
    }
  };

  const totalWorkers = entries.reduce((sum, e) => sum + e.workerCount, 0);
  const totalCost = entries.reduce((sum, e) => sum + e.totalCost, 0);

  return (
    <div className="space-y-6">
      {/* Date & Site */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Entry
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose Site" />
              </SelectTrigger>
              <SelectContent>
                {siteOptions.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Worker Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Add Worker</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>Category</Label>
            <Select
              value={currentEntry.category}
              onValueChange={(value) =>
                setCurrentEntry({ ...currentEntry, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {workerCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name} ({cat.short_code}) - ₹{cat.hourly_rate}/hr
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Normal Hrs</Label>
            <Input
              type="number"
              value={currentEntry.normalHours}
              onChange={(e) =>
                setCurrentEntry({ ...currentEntry, normalHours: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>OT Hrs</Label>
            <Input
              type="number"
              value={currentEntry.overtimeHours}
              onChange={(e) =>
                setCurrentEntry({ ...currentEntry, overtimeHours: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>Workers</Label>
            <Input
              type="number"
              value={currentEntry.workerCount}
              onChange={(e) =>
                setCurrentEntry({ ...currentEntry, workerCount: parseInt(e.target.value) || 1 })
              }
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={addEntry}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="flex justify-between bg-gray-100 p-3 rounded">
                <div>
                  <p className="font-medium">{entry.category}</p>
                  <p className="text-sm text-gray-600">
                    {entry.workerCount} workers × {entry.normalHours}h + {entry.overtimeHours}h OT
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-600">₹{entry.totalCost.toFixed(0)}</p>
                  <p className="text-xs">@₹{entry.rate}/hr</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeEntry(entry.id)}>
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="mt-4 p-4 bg-blue-50 rounded flex justify-between font-semibold text-blue-800">
              <p>Total Workers: {totalWorkers}</p>
              <p>Total Cost: ₹{totalCost.toLocaleString()}</p>
            </div>
            <Button className="w-full bg-green-600" onClick={saveDaily}>
              Save Daily Entry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyEntryForm;