/**
 * Set right before the admin signs out from the account menu, so the route guard sends them to a plain
 * `/login` (no "take me back" redirect), as the reference design does. Cleared once the login screen mounts.
 */
let intentional = false;

export const markIntentionalSignOut = () => {
  intentional = true;
};

export const isIntentionalSignOut = () => intentional;

export const clearIntentionalSignOut = () => {
  intentional = false;
};
