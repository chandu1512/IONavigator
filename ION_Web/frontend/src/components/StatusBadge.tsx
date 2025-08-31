type Props = { status: "completed" | "running" | "pending" | "failed" | "not_started" | "stopped"; };
export default function StatusBadge({ status }: Props) {
    const map: Record<string, string> = {
        completed: "badge success",
        running: "badge pending",
        pending: "badge pending",
        failed: "badge fail",
        stopped: "badge",
        not_started: "badge",
    };
    const label = status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());
    return <span className={map[status] || "badge"}>{label}</span>;
}
