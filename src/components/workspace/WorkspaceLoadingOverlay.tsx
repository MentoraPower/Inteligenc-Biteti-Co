import { motion } from 'framer-motion';
import scaleLogoSidebar from '@/assets/scale-logo-sidebar.png';

export function WorkspaceLoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
    >
      <motion.img
        src={scaleLogoSidebar}
        alt="Loading"
        className="h-16 w-16"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}
