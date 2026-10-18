import { redirect } from "next/navigation";

// As paragens guardadas pelo passageiro estão no separador "Missões" da página da conta
export default function MyTransportsPage() {
  redirect("/user-info?tab=missoes");
}
