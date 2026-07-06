type SetupErrorProps = {
  message: string;
  title?: string;
};

export function SetupError({ message, title = "Setup issue" }: SetupErrorProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-900">{title}</h2>
      <p className="mt-2 text-sm text-red-800">{message}</p>
    </div>
  );
}
