export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="text-center">
        <p className="text-4xl mb-2">🚫</p>
        <h1 className="font-serif text-2xl text-brand-text mb-2">Access Denied</h1>
        <p className="text-brand-muted">Your account does not have admin access.</p>
      </div>
    </div>
  );
}
