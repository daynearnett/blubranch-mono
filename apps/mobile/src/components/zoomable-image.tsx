// Instagram-style pinch-to-zoom for feed photos: two-finger pinch scales the
// image around the fingers' focal point (clamped 1–4x), and releasing springs
// it back to rest. The zoom is clipped to the photo's own frame (the parent
// container keeps overflow hidden), so it cannot disturb the carousel paging,
// the tab pager, or the feed list — a pinch needs two pointers, which none of
// those scrollables claim.
import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const MAX_SCALE = 4;
const SPRING = { damping: 20, stiffness: 220 };

export function ZoomableImage({ uri, width }: { uri: string; width: number }) {
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const pinching = useSharedValue(false);

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      pinching.value = true;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(e.scale, 1), MAX_SCALE);
      // Track the focal point so the zoom follows the fingers (this also
      // gives a natural two-finger pan while zoomed).
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onEnd(() => {
      pinching.value = false;
      scale.value = withSpring(1, SPRING);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const half = width / 2;
    // Zoom around the focal point: shift so the point under the fingers
    // stays put while the image scales. Collapses to identity at scale 1.
    const tx = (focalX.value - half) * (1 - scale.value);
    const ty = (focalY.value - half) * (1 - scale.value);
    return {
      transform: [{ translateX: tx }, { translateY: ty }, { scale: scale.value }],
    };
  });

  return (
    <GestureDetector gesture={pinch}>
      <Animated.View style={[{ width, aspectRatio: 1 }, animatedStyle]}>
        <Image source={{ uri }} style={styles.image} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
