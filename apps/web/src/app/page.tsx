import { AuthButton } from "@/components/AuthButton";
import { Counter } from "@/components/Counter";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Superman Team</h1>
        <AuthButton />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <Counter />
      </main>
    </div>
  );
}
