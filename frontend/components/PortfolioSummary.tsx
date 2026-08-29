export function PortfolioSummary({
  totalVerifiedHours,
  memberSince,
}: {
  totalVerifiedHours: number;
  memberSince: string;
}) {
  return (
    <div className="flex gap-6 rounded border border-gray-200 p-4">
      <div>
        <p className="text-2xl font-bold">{totalVerifiedHours}</p>
        <p className="text-sm text-gray-600">Verified hours</p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Member since {new Date(memberSince).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
