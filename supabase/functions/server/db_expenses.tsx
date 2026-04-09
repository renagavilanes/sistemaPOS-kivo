// Database helper functions for expenses
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get all expenses for a business
export async function getExpenses(businessId: string, filters?: {
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('business_id', businessId)
    .order('expense_date', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('expense_date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('expense_date', filters.endDate);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

// Get a single expense
export async function getExpenseById(expenseId: string, businessId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .eq('business_id', businessId)
    .single();

  if (error) throw error;
  return data;
}

// Create a new expense
export async function createExpense(businessId: string, expenseData: {
  category: string;
  amount: number;
  description?: string;
  supplier?: string;
  payment_method: string;
  expense_date?: string;
  reference?: string;
}) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      business_id: businessId,
      category: expenseData.category,
      amount: expenseData.amount,
      description: expenseData.description || null,
      supplier: expenseData.supplier || null,
      payment_method: expenseData.payment_method,
      expense_date: expenseData.expense_date || new Date().toISOString().split('T')[0],
      reference: expenseData.reference || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update an expense
export async function updateExpense(expenseId: string, businessId: string, updates: {
  category?: string;
  amount?: number;
  description?: string;
  supplier?: string;
  payment_method?: string;
  expense_date?: string;
  reference?: string;
}) {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', expenseId)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete an expense
export async function deleteExpense(expenseId: string, businessId: string) {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('business_id', businessId);

  if (error) throw error;
  return true;
}
