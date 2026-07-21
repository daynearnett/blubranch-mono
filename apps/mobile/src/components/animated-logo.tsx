// Animated BluBranch mark for the splash overlay: the lower "b" draws first
// (ring sweep + stem climbing off it), then the upper "b" grows off the same
// stem, and finally the twig sprouts up-left. Geometry is a stroked-SVG
// recreation measured off assets/icon.png (rings r=91 centerline, stroke 70,
// vertical #B0C4DE→#4682B4 gradient) so the finished frame matches the static
// brand mark everywhere else in the app.
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Path lengths (px in the 1024 viewBox): circles 2π·91, lines measured.
const RING_LEN = 572;
const STEM_LEN = 255;
const TWIG_LEN = 313;

// Stagger (ms): lower ring → stem → upper ring → twig.
const TIMING = {
  lowerRing: { delay: 100, duration: 600 },
  stem: { delay: 550, duration: 320 },
  upperRing: { delay: 820, duration: 600 },
  twig: { delay: 1350, duration: 380 },
};
export const LOGO_ANIMATION_MS = TIMING.twig.delay + TIMING.twig.duration; // 1730

export function AnimatedLogo({ size = 180 }: { size?: number }) {
  const lowerRing = useRef(new Animated.Value(RING_LEN)).current;
  const stem = useRef(new Animated.Value(STEM_LEN)).current;
  const upperRing = useRef(new Animated.Value(RING_LEN)).current;
  const twig = useRef(new Animated.Value(TWIG_LEN)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    const run = (v: Animated.Value, t: { delay: number; duration: number }) =>
      Animated.timing(v, {
        toValue: 0,
        duration: t.duration,
        delay: t.delay,
        easing: ease,
        // strokeDashoffset is an SVG prop — JS-driven animation required.
        useNativeDriver: false,
      });
    Animated.parallel([
      run(lowerRing, TIMING.lowerRing),
      run(stem, TIMING.stem),
      run(upperRing, TIMING.upperRing),
      run(twig, TIMING.twig),
    ]).start();
  }, [lowerRing, stem, upperRing, twig]);

  return (
    <Svg width={size} height={size} viewBox="150 90 730 830">
      <Defs>
        <LinearGradient id="markGradient" x1="0" y1="180" x2="0" y2="842" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#B0C4DE" />
          <Stop offset="1" stopColor="#4682B4" />
        </LinearGradient>
      </Defs>
      {/* lower b — ring sweeps from where the stem lands, then the stem climbs */}
      <AnimatedPath
        d="M 524 719 A 91 91 0 1 1 706 719 A 91 91 0 1 1 524 719"
        stroke="url(#markGradient)"
        strokeWidth={70}
        fill="none"
        strokeDasharray={`${RING_LEN} ${RING_LEN}`}
        strokeDashoffset={lowerRing}
      />
      {/* stem runs flush down the lower ring's left side and blends at its
          tangent point (527,700) — matches the real mark's lowercase-b join */}
      <AnimatedPath
        d="M 527 700 L 527 445"
        stroke="url(#markGradient)"
        strokeWidth={70}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${STEM_LEN} ${STEM_LEN}`}
        strokeDashoffset={stem}
      />
      {/* upper b — grows off the stem it just climbed */}
      <AnimatedPath
        d="M 563 437 A 91 91 0 1 1 563 255 A 91 91 0 1 1 563 437"
        stroke="url(#markGradient)"
        strokeWidth={70}
        fill="none"
        strokeDasharray={`${RING_LEN} ${RING_LEN}`}
        strokeDashoffset={upperRing}
      />
      {/* twig sprouts up-left from the junction */}
      <AnimatedPath
        d="M 505 447 L 317 197"
        stroke="url(#markGradient)"
        strokeWidth={70}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${TWIG_LEN} ${TWIG_LEN}`}
        strokeDashoffset={twig}
      />
    </Svg>
  );
}
