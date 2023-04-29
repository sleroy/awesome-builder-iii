<template>
  <section class="section bg-gray-50 dark:bg-gray-900">
    <div
      class="flex flex-col items-center px-6 py-8 mx-auto md:h-screen lg:py-0"
    >
      <a
        href="#"
        class="flex items-center mb-6 text-2xl font-semibold text-gray-900 dark:text-white"
      >
        <img class="w-8 h-8 mr-2" src="/images/favicon.png" alt="logo" />
        Watchflix
      </a>
      <div
        class="w-full bg-white rounded-lg shadow dark:border dark:border-gray-700 dark:bg-gray-800 sm:max-w-md md:mt-0 xl:p-0"
      >
        <div class="p-6 space-y-4 sm:p-8 md:space-y-6">
          <h1
            class="text-xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white md:text-2xl"
          >
            Sign in to your account
          </h1>
          <form
            class="space-y-4 md:space-y-6"
            action="#"
            @submit.prevent="login"
          >
            <div>
              <label
                for="email"
                class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >Your email</label
              >
              <input
                type="email"
                name="email"
                id="email"
                v-model="email"
                class="focus:ring-primary-600 focus:border-primary-600 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500 sm:text-sm"
                placeholder="name@company.com"
                required=""
              />
            </div>
            <div>
              <label
                for="nickname"
                class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >Username</label
              >
              <input
                type="nickname"
                name="nickname"
                id="nickname"
                v-model="nickname"
                class="focus:ring-primary-600 focus:border-primary-600 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500 sm:text-sm"
                placeholder="username"
                required=""
              />
            </div>
            <div>
              <label
                for="password"
                class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >Password</label
              >
              <input
                type="password"
                name="password"
                id="password"
                placeholder="••••••••"
                v-model="password"
                class="focus:ring-primary-600 focus:border-primary-600 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500 sm:text-sm"
                required=""
              />
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-start">
                <div class="flex items-center h-5">
                  <input
                    id="remember"
                    aria-describedby="remember"
                    v-model="rememberme"
                    type="checkbox"
                    class="w-4 h-4 border border-gray-300 rounded focus:ring-3 focus:ring-primary-300 dark:focus:ring-primary-600 bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                  />
                </div>
                <div class="ml-3 text-sm">
                  <label for="remember" class="text-gray-500 dark:text-gray-300"
                    >Remember me</label
                  >
                </div>
              </div>
              <a
                href="#"
                class="text-sm font-medium text-primary-600 dark:text-primary-500 hover:underline"
                >Forgot password?</a
              >
            </div>
            <button
              type="submit"
              :disabled="inProgress"
              :class="{'dark:bg-gray-600': inProgress ,  'dark:bg-primary-600': !inProgress}"
              class="hover:bg-primary-700 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800 w-full rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-medium text-white focus:outline-none focus:ring-4"
            >
              {{inProgress ? "In progress..." : "Sign in"}}
            </button>
            <p class="text-sm font-light text-gray-500 dark:text-gray-400">
              Don’t have an account yet?
              <a
                href="#"
                class="font-medium text-primary-600 dark:text-primary-500 hover:underline"
                >Sign up</a
              >
            </p>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import * as AmazonCognitoIdentity from "amazon-cognito-identity-js";
import { userPool, isSessionValid } from '../../auth/userPool';

export default {
  setup() {},
  data() {
    return {
      email: "",
      nickname: "",
      password: "",
      rememberme: false,
      error: false,
      inProgress: false,
    };
  },
  computed: {
    userData() {
      var userData = {
            Username: this.email,
            Pool: userPool,
          };
          return userData;
    }
  },
  mounted() {
    let isLogged = isSessionValid();
    if (isLogged) {
      window.open("/video/upload", "_self")
    }
  },
  methods: {

    async login() {
      try {
        var cognitoUser = userPool.getCurrentUser();
        console.log(cognitoUser);
        if (!isSessionValid()) {
          this.inProgress = true;
          var authenticationData = {
            Username: this.email,
            Password: this.password,
            nickname: this.nickname,
          };
          var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

          const me = this;
          let cognitoUser: AmazonCognitoIdentity.CognitoUser = new AmazonCognitoIdentity.CognitoUser(this.userData);
          cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function (
              session: AmazonCognitoIdentity.CognitoUserSession,
              userConfirmationNecessary?: boolean
            ) {
              var accessToken = session.getAccessToken().getJwtToken();
              var idToken = session.getIdToken().getJwtToken();
              console.log("Authentication success", accessToken, idToken);

              localStorage.setItem("access-token", accessToken);
              localStorage.setItem("id-token", idToken);
              window.open("/video/upload", "_self")
              me.inProgress = false;

            },
            newPasswordRequired: function (userAttributes, requiredAttributes) {
              /**delete userAttributes.email_verified;
              cognitoUser.completeNewPasswordChallenge(
                "DemoPassword1!",
                userAttributes,
                {
                  onSuccess: (data) => {
                    console.log("Password has been updated", data);
                  },
                  onFailure: function (err) {
                    alert("Cannot change the password " + err);
                  },
                }
              );
              **/
              alert("User has to change its password")
            },
            onFailure: function (err) {
              me.inProgress = false;
              alert(err);
            },
          });
        }
      } catch {
        this.error = true;
      }
    },
  },
};
</script>
