/**
 * linking.ts
 * Maps deep link URLs to screen names so React Navigation knows where to send
 * the user when they tap an invite link outside the app.
 *
 * URL format:  accountibuzz://join?code=XXXXXXXX
 * This config tells React Navigation to open JoinGroupScreen with the code
 * pre-filled in route.params.inviteCode.
 */

import { LinkingOptions } from '@react-navigation/native'

// accountibuzz://join?code=XXXXXXXX → JoinGroupScreen with inviteCode pre-filled
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['accountibuzz://'],
  config: {
    screens: {
      HomeTab: {
        screens: {
          JoinGroup: {
            path: 'join',
            parse: {
              inviteCode: (code: string) => code.toUpperCase(),
            },
          },
        },
      },
    },
  },
}
