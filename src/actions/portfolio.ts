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
    .order('display_order', { foreignTable: 'assets', ascending: true })
  
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
  manual_price_override?: number | null,
  manual_price_set_at?: string | null,
  is_active?: boolean
}) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('assets')
    .update(updates)
    .eq('id', assetId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath('/dashboard')
  return data
}

export async function toggleAssetActive(assetId: string, isActive: boolean) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('assets')
    .update({ is_active: isActive })
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

export async function reorderAssets(assetIds: string[]) {
  const supabase = await createClient()
  
  const updates = assetIds.map((id, index) => ({
    id,
    display_order: index
  }))
  
  const results = await Promise.all(
    updates.map(({ id, display_order }) =>
      supabase
        .from('assets')
        .update({ display_order })
        .eq('id', id)
    )
  )
  
  for (const result of results) {
    if (result.error) throw new Error(result.error.message)
  }
  
  revalidatePath('/dashboard')
}
