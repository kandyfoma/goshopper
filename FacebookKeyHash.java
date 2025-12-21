import java.security.MessageDigest;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.io.FileInputStream;
import android.util.Base64;

public class FacebookKeyHash {
    public static void main(String[] args) {
        try {
            String keystorePath = System.getProperty("user.home") + "/.android/debug.keystore";
            KeyStore keystore = KeyStore.getInstance(KeyStore.getDefaultType());
            FileInputStream fis = new FileInputStream(keystorePath);
            keystore.load(fis, "android".toCharArray());
            fis.close();
            
            Certificate cert = keystore.getCertificate("androiddebugkey");
            MessageDigest md = MessageDigest.getInstance("SHA1");
            byte[] publicKey = md.digest(cert.getEncoded());
            String hash = android.util.Base64.encodeToString(publicKey, android.util.Base64.NO_WRAP);
            
            System.out.println("Facebook Key Hash: " + hash);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
