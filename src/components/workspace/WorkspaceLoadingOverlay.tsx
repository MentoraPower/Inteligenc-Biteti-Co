import { motion } from 'framer-motion';

export function WorkspaceLoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
    >
      <motion.span
        className="text-2xl font-bold tracking-tight text-foreground"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        Biteti &amp; Co Inteligenc
      </motion.span>
    </motion.div>
  );
}
