// app/src/features/Splash/SplashScreen.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const carSlide = useRef(new Animated.Value(-width - 100)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animations
    const animationSequence = Animated.sequence([
      // Logo entrance with bounce
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 10,
        friction: 2,
        useNativeDriver: true,
      }),
      // Car slides in and text appears
      Animated.parallel([
        Animated.timing(carSlide, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 800,
          delay: 300,
          useNativeDriver: true,
        }),
      ]),
    ]);

    // Start the main animation sequence
    animationSequence.start();

    // Subtle continuous rotation for the "C" background
    const rotationLoop = Animated.loop(
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      }),
    );
    rotationLoop.start();

    // Shimmer effect
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmerLoop.start();

    // Complete after animations are done
    const timer = setTimeout(() => {
      onAnimationComplete();
    }, 4500); // Reduced from 6000 to make transition faster

    return () => {
      clearTimeout(timer);
      rotationLoop.stop();
      shimmerLoop.stop();
    };
  }, []);

  const logoRotation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerOpacity = shimmerAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return (
    <LinearGradient
      colors={['#1e3a5f', '#0a2342']}
      style={styles.container}
    >
      {/* Animated background circles */}
      <Animated.View
        style={[
          styles.backgroundCircle,
          {
            opacity: shimmerOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      />

      {/* Main Logo Container */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        {/* The "C" Shape with gradient */}
        <Animated.View
          style={[
            styles.cShape,
            {
              transform: [{ rotate: logoRotation }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            style={styles.cGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Car Icon */}
        <Animated.View
          style={[
            styles.carContainer,
            {
              transform: [{ translateX: carSlide }],
            },
          ]}
        >
          <View style={styles.car}>
            <View style={styles.carBody} />
            <View style={styles.carWindshield} />
            <View style={styles.carWheelContainer}>
              <View style={styles.carWheel} />
              <View style={styles.carWheel} />
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* V2X DEMO Text */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
          },
        ]}
      >
        <Text style={styles.v2xText}>V2X</Text>
        <Text style={styles.demoText}>DEMO</Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.Text
        style={[
          styles.subtitle,
          {
            opacity: textOpacity,
          },
        ]}
      >
        Vehicle-to-Everything Communication
      </Animated.Text>

      {/* Loading dots */}
      <Animated.View
        style={[
          styles.loadingContainer,
          {
            opacity: textOpacity,
          },
        ]}
      >
        {[0, 1, 2].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.loadingDot,
              {
                opacity: shimmerAnimation.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: index === 0 ? [1, 0.3, 1] : index === 1 ? [0.3, 1, 0.3] : [0.5, 0.3, 0.5],
                }),
              },
            ]}
          />
        ))}
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundCircle: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  logoContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  cShape: {
    position: 'absolute',
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cGradient: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 35,
    borderColor: 'transparent',
    borderRightColor: '#FFD700',
    borderTopColor: '#FFD700',
    borderBottomColor: '#FFD700',
    transform: [{ rotate: '45deg' }],
  },
  carContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  car: {
    width: 80,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carBody: {
    width: 70,
    height: 35,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    position: 'absolute',
    bottom: 10,
  },
  carWindshield: {
    width: 40,
    height: 25,
    backgroundColor: '#1e3a5f',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    position: 'absolute',
    top: 12,
    left: 15,
  },
  carWheelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 60,
    position: 'absolute',
    bottom: 5,
  },
  carWheel: {
    width: 12,
    height: 12,
    backgroundColor: '#0a2342',
    borderRadius: 6,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  v2xText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 3,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  demoText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 15,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 10,
    letterSpacing: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    marginTop: 50,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    marginHorizontal: 5,
  },
});

export default SplashScreen;