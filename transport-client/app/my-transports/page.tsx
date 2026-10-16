import { redirect } from "next/navigation";

// The passenger's saved stops live in the "Missões" tab of the account page
export default function MyTransportsPage() {
  redirect("/user-info?tab=missoes");
}
