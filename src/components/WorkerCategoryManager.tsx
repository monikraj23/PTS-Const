"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Users, Plus, Settings, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface WorkerCategory {
  id: string;
  name: string;
  short_code: string;
  hourly_rate: number;
  overtime_multiplier: number;
  is_active: boolean;
}

const WorkerCategoryManager = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<WorkerCategory[]>([]);
  const [newCategory, setNewCategory] = useState({
    name: "",
    short_code: "",
    hourly_rate: 0,
    overtime_multiplier: 1.5,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchCategories = async () => {
    const { data, error } = await supabase.from("worker_categories").select("*").order("name");
    if (error) {
      toast({ title: "Error fetching categories", description: error.message, variant: "destructive" });
    } else {
      setCategories(data as WorkerCategory[]);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const addCategory = async () => {
    const { name, short_code, hourly_rate, overtime_multiplier } = newCategory;

    if (!name || !short_code || hourly_rate <= 0) {
      toast({ title: "Validation Error", description: "Fill all fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("worker_categories").insert([
      {
        name,
        short_code,
        hourly_rate,
        overtime_multiplier,
        is_active: true,
      },
    ]);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Category added successfully" });
      setNewCategory({ name: "", short_code: "", hourly_rate: 0, overtime_multiplier: 1.5 });
      fetchCategories(); // refresh categories list
    }
  };

  const updateCategory = async (id: string, updates: Partial<WorkerCategory>) => {
    const { error } = await supabase.from("worker_categories").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Update Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Category updated" });
      fetchCategories();
      setEditingId(null);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateCategory(id, { is_active: !current });
  };

  const calculateDailyRate = (hourlyRate: number) => hourlyRate * 8;

  const logout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out", description: "You have been logged out successfully." });
    navigate("/login"); // redirect to login page
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Worker Category Manager</h2>
        <Button variant="destructive" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>

      {/* Add Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Worker Category Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label>Category Name</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Mason"
              />
            </div>
            <div>
              <Label>Short Code</Label>
              <Input
                value={newCategory.short_code}
                onChange={(e) => setNewCategory({ ...newCategory, short_code: e.target.value })}
                placeholder="e.g., M"
              />
            </div>
            <div>
              <Label>Hourly Rate (₹)</Label>
              <Input
                type="number"
                value={newCategory.hourly_rate || ""}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, hourly_rate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addCategory} className="w-full bg-orange-500 hover:bg-orange-600">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </div>

          {newCategory.hourly_rate > 0 && (
            <p className="text-sm text-gray-600">
              Daily Rate: ₹<b>{calculateDailyRate(newCategory.hourly_rate)}</b> (8 hrs)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Display Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Current Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="border rounded p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{category.name} ({category.short_code})</h3>
                    <p className="text-sm text-gray-600">
                      ₹{category.hourly_rate}/hr • Daily: ₹{calculateDailyRate(category.hourly_rate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${category.id}`} className="text-sm">Active</Label>
                      <Switch
                        checked={category.is_active}
                        onCheckedChange={() => toggleActive(category.id, category.is_active)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(editingId === category.id ? null : category.id)}
                    >
                      {editingId === category.id ? "Cancel" : "Edit"}
                    </Button>
                  </div>
                </div>

                {editingId === category.id && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Hourly Rate (₹)</Label>
                      <Input
                        type="number"
                        value={category.hourly_rate}
                        onChange={(e) =>
                          updateCategory(category.id, { hourly_rate: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <Label>OT Multiplier</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={category.overtime_multiplier}
                        onChange={(e) =>
                          updateCategory(category.id, { overtime_multiplier: parseFloat(e.target.value) || 1.5 })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerCategoryManager;