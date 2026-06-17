// app/src/features/Onboarding/OnboardingScreen.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  iconColor: string;
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    title: 'Welcome to V2X',
    subtitle: 'Connected Vehicle Technology',
    description: 'Experience real-time vehicle-to-everything communication that enhances road safety and traffic efficiency.',
    icon: 'car-connected',
    iconColor: '#FFD700',
  },
  {
    id: 2,
    title: 'Real-Time Alerts',
    subtitle: 'Pedestrian Safety First',
    description: 'Get instant notifications when pedestrians are in crosswalks, ensuring safer intersections for everyone.',
    icon: 'walk',
    iconColor: '#4CAF50',
  },
  {
    id: 3,
    title: 'Smart Traffic Signals',
    subtitle: 'SPaT Technology',
    description: 'View signal phase and timing information to optimize your route and reduce wait times at intersections.',
    icon: 'traffic-light',
    iconColor: '#FF6B6B',
  },
  {
    id: 4,
    title: 'Vehicle Detection',
    subtitle: 'SDSM Integration',
    description: 'Track nearby vehicles in real-time using Safety Data for Sustainable Mobility technology.',
    icon: 'radar',
    iconColor: '#2196F3',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: (currentSlide + 1) * width,
        animated: true,
      });
      setCurrentSlide(currentSlide + 1);
      animateTransition();
    }
  };

  const handleSkip = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete();
    });
  };

  const animateTransition = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleScroll = (event: any) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
    }
  };

  return (
    <LinearGradient colors={['#0a2342', '#1e3a5f']} style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slides */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
        >
          {slides.map((slide) => (
            <View key={slide.id} style={styles.slide}>
              {/* Icon Container */}
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '20' }]}>
                  <Icon name={slide.icon as any} size={80} color={slide.iconColor} />
                </View>
                {/* Animated rings */}
                <View style={[styles.ring, styles.ring1]} />
                <View style={[styles.ring, styles.ring2]} />
              </View>

              {/* Text Content */}
              <View style={styles.textContainer}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Page Indicators */}
          <View style={styles.pagination}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  currentSlide === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>

          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            {currentSlide === slides.length - 1 ? (
              <TouchableOpacity style={styles.getStartedButton} onPress={handleSkip}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.getStartedText}>Get Started</Text>
                  <Icon name="arrow-right" size={24} color="#0a2342" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.nextText}>Next</Text>
                  <Icon name="arrow-right" size={24} color="#0a2342" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '600',
  },
  slide: {
    width: width,
    height: height,
    paddingTop: 100,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  iconContainer: {
    width: 200,
    height: 200,
    marginBottom: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  ring: {
    position: 'absolute',
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  ring1: {
    width: 180,
    height: 180,
    // animation: 'pulse 2s infinite', // Not supported in React Native
  },
  ring2: {
    width: 200,
    height: 200,
    // animation: 'pulse 2s infinite 0.5s', // Not supported in React Native
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 5,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#FFD700',
  },
  buttonContainer: {
    alignItems: 'center',
  },
  nextButton: {
    width: width - 60,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  getStartedButton: {
    width: width - 60,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  gradientButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  nextText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a2342',
    marginRight: 10,
  },
  getStartedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a2342',
    marginRight: 10,
  },
});

export default OnboardingScreen;