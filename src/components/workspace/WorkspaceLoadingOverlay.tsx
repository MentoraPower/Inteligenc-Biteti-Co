import { motion } from 'framer-motion';

export function WorkspaceLoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
    >
      <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
    </motion.div>
  );
}
