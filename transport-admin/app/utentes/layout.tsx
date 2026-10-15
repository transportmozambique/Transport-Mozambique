import AdminLayout from "../components/AdminLayout";

export default function UtentesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
