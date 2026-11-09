import { httpResource } from '@angular/common/http';
import { computed, Injectable } from '@angular/core';

interface UserInfo {
  email: string;
  preferredUsername?: string;
  additionalClaims?: { name?: string };
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly userInfo = httpResource<UserInfo>(() => '/oauth2/userinfo');

  readonly profile = computed(() => {
    if (!this.userInfo.hasValue()) return undefined;
    const user = this.userInfo.value();
    const name = (user.additionalClaims?.name ?? user.preferredUsername ?? user.email).trim();
    return name ? {
      name,
      initials: name.split(/\s+/).map(part => part[0]).join('').toUpperCase(),
    } : undefined;
  });
}
