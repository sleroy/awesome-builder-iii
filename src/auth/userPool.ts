/**
 * Declare Cognito User pool.
 */
import { Amplify, Auth } from 'aws-amplify';
import awsmobile from '../aws-exports';

Amplify.configure(awsmobile);


export async function isSessionValid() {
    try {
        await Auth.currentAuthenticatedUser();
        return true;
    } catch {
        return false;
    }
}
