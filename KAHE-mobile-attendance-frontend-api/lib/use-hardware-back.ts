import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/** Keep Android Back aligned with the visible screen's Back action. */
export function useHardwareBack(onBack: () => boolean) {
  const handler = useRef(onBack);
  useEffect(() => { handler.current = onBack; }, [onBack]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => handler.current());
    return () => subscription.remove();
  }, []);
}
