export function WorkspaceLoadingOverlay() {
  // Transparent loader over the content area only — the navbar, menu, workspace
  // button and rounded corner stay visible and are never covered.
  return (
    <div className="fixed top-[60px] left-16 right-0 bottom-0 z-[100] flex items-center justify-center">
      <div className="ws-loading-track">
        <div className="ws-loading-fill" />
      </div>
    </div>
  );
}
