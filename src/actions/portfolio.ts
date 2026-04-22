'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPortfolio(name: string, currency: string = 'ILS') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('portfolios')
    .insert([{ name, currency, user_id: user.id }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard')
  return data
}

export async function getPortfolios() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('portfolios')
    .select('*, assets(*)')
  
  if (error) throw new Error(error.message)
  return data
}

export async function addAsset(portfolioId: string, ticker: string, targetPercentage: number, sharesOwned: number, name?: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('assets')
    .insert([{
      portfolio_id: portfolioId,
      ticker,
      name,
      target_percentage: targetPercentage,
      shares_owned: sharesOwned
    }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard')
  return data
}

export async function updateAsset(assetId: string, updates: { 
  target_percentage?: number, 
  shares_owned?: number,
  name?: string,
  manual_value?: number | null 
}) {
  const supabase = await createClient()
  
  // Convert manual_value to manual_price_override
  const updateData: any = { ...updates };
  delete updateData.manual_value; // Remove manual_value from updates
  
  if (updates.manual_value !== undefined) {
    if (updates.manual_value !== null) {
      // Setting a manual value - calculate price per share
      const { data: asset } = await supabase
        .from('assets')
        .select('shares_owned')
        .eq('id', assetId)
        .single();
      
      if (asset && asset.shares_owned > 0) {
        const pricePerShare = updates.manual_value / asset.shares_owned;
        updateData.manual_price_override = pricePerShare;
        updateData.manual_price_set_at = new Date().toISOString();
      }
    } else {
      // Clearing manual value
      updateData.manual_price_override = null;
      updateData.manual_price_set_at = null;
    }
  }
  
  const { data, error } = await supabase
    .from('assets')
    .update(updateData)
    .eq('id', assetId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard')
  return data
}

export async function deleteAsset(assetId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)

  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard')
}
