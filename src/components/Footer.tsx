export default function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-zinc-500">
        &copy; {new Date().getFullYear()} Satish Kumar. All rights reserved.
      </div>
    </footer>
  );
}
