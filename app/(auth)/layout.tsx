export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
