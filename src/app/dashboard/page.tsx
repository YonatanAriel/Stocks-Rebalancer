import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getPortfolios } from "@/actions/portfolio";
import { DashboardShell } from "@/components/dashboard-shell";
import { SetupWizard } from "@/components/setup-wizard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const portfolios = await getPortfolios();

  if (!portfolios || portfolios.length === 0) {
    return <SetupWizard />;
  }

  const portfolio = portfolios[0];

  return <DashboardShell portfolio={portfolio} userEmail={user.email ?? ""} />;
}
