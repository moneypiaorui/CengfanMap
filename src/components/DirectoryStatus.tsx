interface DirectoryStatusProps {
  loading: boolean;
  onRetry: () => void;
}

export default function DirectoryStatus({
  loading,
  onRetry,
}: DirectoryStatusProps) {
  if (loading)
    return (
      <div className="data-status data-status--loading" role="status">
        正在加载班级信息…
      </div>
    );
  return (
    <div className="data-status" role="alert">
      <h2>暂时无法加载班级信息</h2>
      <p>请稍后重试，或检查网络连接。</p>
      <button onClick={onRetry}>重新加载</button>
    </div>
  );
}
