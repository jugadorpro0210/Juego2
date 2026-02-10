import React from 'react';

interface ToastProps {
  message: string | null;
}

const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
      <div className="bg-red-500/90 text-white px-6 py-3 rounded-full shadow-lg border border-red-600 font-semibold backdrop-blur-sm">
        {message}
      </div>
    </div>
  );
};

export default Toast;
