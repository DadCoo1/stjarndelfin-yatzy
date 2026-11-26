// FrauLeins som Android-app: en Trusted Web Activity – spelet körs i Chrome i helskärm, med samma
// data (inloggning, rekord, bubbelpoäng) som i Chrome och med notiser som visas som appens egna.
// Två varianter som kan ligga bredvid varandra: "vanlig" (main) och "dev" (testversionen).
plugins { id("com.android.application") }

android {
    namespace = "se.frauleins.board"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    flavorDimensions += "kanal"
    productFlavors {
        create("vanlig") {
            dimension = "kanal"
            applicationId = "se.frauleins.board"
            resValue("string", "providerAuthority", "se.frauleins.board.fileprovider")
            manifestPlaceholders += mapOf(
                "hostName" to "dadcoo1.github.io",
                "pathPrefix" to "/stjarndelfin-yatzy/",
                "launchUrl" to "https://dadcoo1.github.io/stjarndelfin-yatzy/?app=android"
            )
        }
        create("dev") {
            dimension = "kanal"
            applicationId = "se.frauleins.board.dev"
            resValue("string", "providerAuthority", "se.frauleins.board.dev.fileprovider")
            manifestPlaceholders += mapOf(
                "hostName" to "dadcoo1.github.io",
                "pathPrefix" to "/stjarndelfin-yatzy/dev/",
                "launchUrl" to "https://dadcoo1.github.io/stjarndelfin-yatzy/dev/?app=android"
            )
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // ingen signering här – appen signeras med en fast nyckel efter bygget (nyckeln finns aldrig i repot)
        }
    }
    lint { checkReleaseBuilds = false; abortOnError = false }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
