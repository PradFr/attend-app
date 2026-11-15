import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from "react";
import { login, type AuthSession } from "../lib/api";
import { colors, iconName, getErrorMessage } from "../theme";
import { styles } from "../styles";
import { Action } from "../components/ui";


export function LoginScreen({ onAuthenticated }: { onAuthenticated: (auth: AuthSession) => void }) {
  const scroll = useRef<ScrollView>(null);
  const passwordInput = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const revealForm = () => { if (keyboardVisible) scroll.current?.scrollToEnd({ animated: true }); };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleType, setRoleType] = useState<"student" | "faculty">("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRoleSelect = (role: "student" | "faculty") => {
    setRoleType(role);
    setError("");
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const session = await login(email.trim(), password);
      onAuthenticated(session);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={scroll} onContentSizeChange={revealForm} onLayout={revealForm} keyboardShouldPersistTaps="handled" keyboardDismissMode="none" contentContainerStyle={styles.loginContainer} showsVerticalScrollIndicator={false}>
        {/* University Crest Header */}
        <View style={[styles.loginHeader, keyboardVisible && { marginBottom: 16 }]}>
          {!keyboardVisible && <Image source={require("../assets/university-logo.png")} style={styles.universityLogo} resizeMode="contain" accessibilityLabel="Karpagam Academy of Higher Education logo" />}
          <Text style={styles.universityKicker}>KARPAGAM ACADEMY OF HIGHER EDUCATION</Text>
          <Text style={styles.loginMainTitle}>Campus attendance</Text>
          <Text style={styles.loginSubtitle}>
            Classroom QR attendance and professor verification for students and faculty.
          </Text>
        </View>

        {/* Role Toggle Selector */}
        <View style={styles.roleToggleContainer}>
          <Pressable
            onPress={() => handleRoleSelect("student")}
            style={[styles.roleToggleButton, roleType === "student" && styles.roleToggleActive]}
          >
            <MaterialCommunityIcons
              name={iconName("account-school")}
              size={18}
              color={roleType === "student" ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.roleToggleText, roleType === "student" && styles.roleToggleTextActive]}>
              Student
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleRoleSelect("faculty")}
            style={[styles.roleToggleButton, roleType === "faculty" && styles.roleToggleActive]}
          >
            <MaterialCommunityIcons
              name={iconName("card-account-details-outline")}
              size={18}
              color={roleType === "faculty" ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.roleToggleText, roleType === "faculty" && styles.roleToggleTextActive]}>
              Faculty
            </Text>
          </Pressable>
        </View>

        {/* Login Form Card */}
        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>University email</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name={iconName("email-outline")} size={18} color={colors.textSubtle} />
            <TextInput
              onFocus={revealForm}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordInput.current?.focus()}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              accessibilityLabel="University email"
              keyboardType="email-address"
              placeholder="e.g. yourname@university.edu"
              placeholderTextColor={colors.textSubtle}
              style={styles.textInput}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Password</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name={iconName("lock-outline")} size={18} color={colors.textSubtle} />
            <TextInput
              ref={passwordInput}
              onFocus={revealForm}
              returnKeyType="done"
              onSubmitEditing={() => { if (!loading) void handleLogin(); }}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              accessibilityLabel="Password"
              autoComplete="current-password"
              placeholder="Enter password"
              placeholderTextColor={colors.textSubtle}
              style={styles.textInput}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} accessibilityState={{ checked: showPassword }} onPress={() => setShowPassword(value => !value)} style={styles.passwordVisibilityButton}>
              <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.primary} />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name={iconName("alert-circle")} size={16} color={colors.danger} />
              <Text style={[styles.errorBannerText, { flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <Action onPress={handleLogin} disabled={loading}>
              <Text style={styles.actionPrimaryText}>
                {loading ? "Authenticating Session…" : "Sign in"}
              </Text>
              <MaterialCommunityIcons name={iconName("arrow-right")} size={18} color="#FFFFFF" />
            </Action>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
