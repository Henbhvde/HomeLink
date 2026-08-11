export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateLoginForm(email: string, password: string) {
  const errors = {
    email: '',
    password: '',
  };

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'И-мэйл хаягаа оруулна уу.';
  } else if (!isValidEmail(trimmedEmail)) {
    errors.email = 'И-мэйл хаягийг зөв оруулна уу.';
  }

  if (!password.trim()) {
    errors.password = 'Нууц үгээ оруулна уу.';
  }

  return {
    isValid: !errors.email && !errors.password,
    errors,
  };
}

export function validateRegisterForm(name: string, email: string, workspaceName: string, password: string) {
  const errors = {
    name: '',
    email: '',
    workspaceName: '',
    password: '',
  };

  if (!name.trim()) {
    errors.name = 'Таны нэрийг оруулна уу.';
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'И-мэйл хаягаа оруулна уу.';
  } else if (!isValidEmail(trimmedEmail)) {
    errors.email = 'И-мэйл хаягийг зөв оруулна уу.';
  }

  if (!workspaceName.trim()) {
    errors.workspaceName = 'Хотхон / СӨХ-ийн нэрийг оруулна уу.';
  }

  if (password.length < 8) {
    errors.password = 'Нууц үг хамгийн багадаа 8 тэмдэгттэй байна.';
  }

  return {
    isValid: !errors.name && !errors.email && !errors.workspaceName && !errors.password,
    errors,
  };
}

export function validateRecoveryForm(email: string) {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { isValid: false, error: 'И-мэйл хаягаа оруулна уу.' };
  }

  if (!isValidEmail(trimmedEmail)) {
    return { isValid: false, error: 'И-мэйл хаягийг зөв оруулна уу.' };
  }

  return { isValid: true, error: '' };
}

export function validateResetPasswordForm(newPassword: string, confirmPassword: string) {
  const errors = {
    password: '',
    confirmPassword: '',
  };

  if (newPassword.length < 8) {
    errors.password = 'Шинэ нууц үг хамгийн багадаа 8 тэмдэгттэй байна.';
  }

  if (confirmPassword.length < 8) {
    errors.confirmPassword = 'Нууц үгээ дахин оруулна уу.';
  } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    errors.confirmPassword = 'Нууц үгүүд таарахгүй байна.';
  }

  return {
    isValid: !errors.password && !errors.confirmPassword,
    errors,
  };
}

export function validateOtpCode(otp: string[]) {
  const code = otp.join('');
  if (code.length !== 6) {
    return { isValid: false, error: '6 оронтой код оруулна уу.' };
  }

  return { isValid: true, error: '' };
}
