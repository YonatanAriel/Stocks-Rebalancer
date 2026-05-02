'use server'

import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

interface PortfolioItem {
  ticker: string
  value: number
  targetPercent: number
}

export async function getSmartAdvice(
  portfolio: PortfolioItem[],
  cashAmount: number
) {
  const portfolioSummary = portfolio
    .map(
      (item) =>
        `${item.ticker}: $${item.value.toFixed(2)} (${item.targetPercent}% target)`
    )
    .join('\n')

  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + item.value, 0)
  const totalWithCash = totalPortfolioValue + cashAmount

  const prompt = `You are a portfolio rebalancing advisor. Analyze this portfolio and suggest how to allocate the incoming cash to bring the portfolio closer to target allocations.

Current Portfolio:
${portfolioSummary}

Available Cash: $${cashAmount.toFixed(2)}
Total Portfolio Value (with cash): $${totalWithCash.toFixed(2)}

Provide specific allocation recommendations for the cash. Consider:
1. Which positions are furthest from their target percentages
2. Technical indicators (RSI, MACD) if you have knowledge of recent market conditions
3. Market sentiment and volatility

Format your response as clear, actionable recommendations with specific dollar amounts for each position.`

  return streamText({
    model: google('gemini-2.0-flash'),
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })
}
